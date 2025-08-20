# .env.example - Copy to .env and fill in your values

# =================================
# Database Configuration
# =================================
DATABASE_URL=postgresql://username:password@localhost:5432/chattranscriptconverter
# Production example: postgresql://user:pass@host:5432/dbname?sslmode=require

# =================================
# Stripe Configuration
# =================================
# Get these from your Stripe Dashboard: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
# Webhook secret from Stripe webhook settings
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs - Create these in your Stripe Dashboard
STRIPE_BASIC_WEEKLY_PRICE_ID=price_1Rg6fnJF6bibA8nesbJ1RvxA
STRIPE_PRO_WEEKLY_PRICE_ID=price_1Rtf6CJF6bibA8nef9w5LhLE
STRIPE_PRO_ANNUAL_PRICE_ID=price_1Rtf9YJF6bibA8nemK14siZ5

# =================================
# Firebase Configuration
# =================================
# Get these from Firebase Console: https://console.firebase.google.com/
FIREBASE_PROJECT_ID=your-project-id

# Optional: Firebase Admin SDK (for server-side auth)
# Download service account key from Firebase Console > Project Settings > Service Accounts
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# =================================
# Application Configuration
# =================================
NODE_ENV=development
PORT=5000

# Generate a secure random string for sessions (at least 32 characters)
SESSION_SECRET=your-super-secure-session-secret-at-least-32-chars

# Storage path for PDF files
STORAGE_PATH=/tmp

# Application URLs (for production deployment)
APP_URL=http://localhost:5000
CLIENT_URL=http://localhost:5000

# =================================
# Development Only
# =================================
# These are only used in development mode
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# =================================
# Production Environment Variables
# =================================
# For production deployment, also set:
# - NODE_ENV=production
# - Proper SSL certificates
# - Production database URL
# - Production Stripe keys (sk_live_... and pk_live_...)
# - Production Firebase project

# =================================
# Optional: Monitoring & Analytics
# =================================
# Add your monitoring service keys here
# SENTRY_DSN=https://...
# DATADOG_API_KEY=...
# NEW_RELIC_LICENSE_KEY=...