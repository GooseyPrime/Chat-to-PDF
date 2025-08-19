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

echo "✅ Build artifacts verified"

echo ""
echo "🎉 Deployment verification complete!"
echo "Your application is ready for Railway deployment."
echo ""
echo "Next steps:"
echo "1. Push to your GitHub repository"
echo "2. Connect to Railway and deploy"
echo "3. Set environment variables in Railway"
echo "4. Configure Stripe webhook URL"