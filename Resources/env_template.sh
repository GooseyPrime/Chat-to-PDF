# .env.example - Copy to .env and fill in your values

# =================================
# Firebase Configuration
# =================================
# Get these from Firebase Console: https://console.firebase.google.com/
FIREBASE_PROJECT_ID=your-project-id

# Firebase Admin SDK (for server-side auth)
# Option 1: Use complete Firebase service account JSON (RECOMMENDED)
# Download service account JSON from Firebase Console > Project Settings > Service Accounts
# Copy the entire JSON content and paste it as the value:
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Option 2: Use individual variables (legacy support)
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

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
# - Production Firebase project
# - Production Stripe keys (sk_live_... and pk_live_...)

# =================================
# Optional: Monitoring & Analytics
# =================================
# Add your monitoring service keys here
# SENTRY_DSN=https://...
# DATADOG_API_KEY=...
# NEW_RELIC_LICENSE_KEY=...