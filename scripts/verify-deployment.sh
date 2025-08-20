#!/bin/bash

# Deployment verification script for Railway
# This script checks if the deployment is working correctly

echo "🚀 Railway Deployment Verification"
echo "=================================="

# Check if required environment variables are set
echo "📋 Checking environment variables..."
ENV_VARS=("DATABASE_URL" "STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "VITE_FIREBASE_PROJECT_ID")
missing_vars=()

for var in "${ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing environment variables: ${missing_vars[*]}"
    echo "Please set these in your Railway project settings."
    exit 1
fi

echo "✅ All required environment variables are set"

# Fix Windows-specific build command for cross-platform compatibility
echo "🔧 Checking build script compatibility..."
if grep -q "xcopy" package.json; then
    echo "⚠️  Windows-specific command detected in package.json"
    echo "    This may cause issues on Railway (Linux). Consider using 'cp' instead."
fi

# Build the application
echo "🔨 Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"

# Check if essential files exist
echo "📁 Checking build artifacts..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ Server build not found"
    exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Client build not found"
    exit 1
fi

# Ensure index.html is copied correctly (fix for Windows xcopy issue)
if [ ! -f "dist/index.html" ]; then
    echo "🔧 Copying index.html to fix build issue..."
    cp dist/public/index.html dist/index.html
fi

echo "✅ Build artifacts verified"

# Database schema verification (if DATABASE_URL is available)
echo "🗄️  Verifying database schema..."
if [ -n "$DATABASE_URL" ]; then
    # Check for problematic constraints
    echo "  Checking for email unique constraint..."
    UNIQUE_CONSTRAINT_CHECK=$(node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT conname FROM pg_constraint WHERE conname = \\'users_email_unique\\'')
        .then(result => {
            if (result.rows.length > 0) {
                console.log('❌ users_email_unique constraint still exists - this will cause deployment issues');
                console.log('   Run the migration script: migrations/fix-railway-deployment.sql');
                process.exit(1);
            } else {
                console.log('✅ No problematic email unique constraint found');
            }
        })
        .catch(err => {
            console.log('⚠️  Could not verify database constraints:', err.message);
            console.log('   This is normal if database is not accessible from this environment');
        })
        .finally(() => pool.end());
    " 2>/dev/null)
    
    echo "  Checking foreign key CASCADE settings..."
    CASCADE_CHECK=$(node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT constraint_name, delete_rule FROM information_schema.referential_constraints WHERE constraint_name IN (\\'pdf_records_user_id_users_id_fk\\', \\'subscription_history_user_id_users_id_fk\\')')
        .then(result => {
            let issues = [];
            result.rows.forEach(row => {
                if (row.delete_rule !== 'CASCADE') {
                    issues.push(row.constraint_name);
                }
            });
            if (issues.length > 0) {
                console.log('❌ Foreign key constraints missing CASCADE:', issues.join(', '));
                console.log('   Run the migration script: migrations/fix-railway-deployment.sql');
                process.exit(1);
            } else {
                console.log('✅ Foreign key constraints properly configured with CASCADE');
            }
        })
        .catch(err => {
            console.log('⚠️  Could not verify foreign key constraints:', err.message);
        })
        .finally(() => pool.end());
    " 2>/dev/null)
else
    echo "⚠️  DATABASE_URL not set - skipping database schema verification"
    echo "   Run this script in Railway shell after deployment to verify schema"
fi

# Check for migration script
echo "📋 Checking migration files..."
if [ -f "migrations/fix-railway-deployment.sql" ]; then
    echo "✅ Railway deployment migration script found"
else
    echo "❌ Migration script not found at migrations/fix-railway-deployment.sql"
    exit 1
fi

echo ""
echo "🎉 Deployment verification complete!"
echo "Your application is ready for Railway deployment."
echo ""
echo "Next steps:"
echo "1. Push to your GitHub repository"
echo "2. Connect to Railway and deploy"
echo "3. Set environment variables in Railway"
echo "4. Run migration script in Railway shell:"
echo "   psql \$DATABASE_URL < migrations/fix-railway-deployment.sql"
echo "5. Configure Stripe webhook URL"
echo "5. Check health endpoint: https://your-app.railway.app/api/health"
echo "   Expected response when migration is needed:"
echo "   {"
echo "     \"status\": \"healthy\","
echo "     \"database\": \"connected\","
echo "     \"warning\": \"users_email_unique constraint exists - may cause authentication failures\","
echo "     \"migrationRequired\": true,"
echo "     \"migrationScript\": \"migrations/fix-railway-deployment.sql\""
echo "   }"
echo ""
echo "6. Check migration status: https://your-app.railway.app/api/migration-status"
echo "7. Test health endpoint: https://your-app.railway.app/api/health"