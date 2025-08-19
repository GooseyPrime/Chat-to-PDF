# Chat-to-PDF

Convert your chat conversations from ChatGPT, Claude, and Gemini into beautifully formatted PDFs with professional styling and clean downloads.

## Features

- **Multi-Platform Support**: Works with ChatGPT, Claude, and Gemini
- **Professional PDF Formatting**: Clean, readable PDF output
- **Subscription Tiers**: Basic and Pro plans with different features
- **Firebase Authentication**: Secure Google Sign-in
- **Real-time Dashboard**: Track usage and subscription status

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Firebase Auth
- **Payments**: Stripe
- **PDF Generation**: Puppeteer

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file with the following variables:
   ```
   # Database
   DATABASE_URL=your_neon_postgres_url

   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Firebase (client-side)
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_APP_ID=your-app-id
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Railway Deployment

Railway is the recommended platform for deploying this application. Follow these steps:

### 1. Prerequisites

- A Railway account ([railway.app](https://railway.app))
- Your environment variables ready
- A PostgreSQL database (Neon recommended)

### 2. Deploy to Railway

1. **Connect your repository**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" 
   - Select "Deploy from GitHub repo"
   - Choose your Chat-to-PDF repository

2. **Configure environment variables**:
   In your Railway project settings, add these variables:

   ```bash
   # Database
   DATABASE_URL=postgresql://username:password@host/database

   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_live_...  # Use live keys for production
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Firebase Configuration
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_API_KEY=your-api-key  
   VITE_FIREBASE_APP_ID=your-app-id

   # Optional: Set Node environment
   NODE_ENV=production
   ```

3. **Stripe Webhook Configuration**:
   - In your Stripe Dashboard, go to Webhooks
   - Add a new webhook endpoint: `https://your-railway-app.railway.app/api/stripe-webhook`
   - Enable these events:
     - `checkout.session.completed`
     - `payment_intent.payment_failed`
     - `invoice.payment_succeeded`
     - `customer.subscription.deleted`

4. **Deploy**:
   - Railway will automatically detect the `Dockerfile` and `railway.json`
   - The application will build and deploy automatically
   - Monitor the build logs in the Railway dashboard

### 3. Post-Deployment

1. **Verify the deployment**:
   - Check the health endpoint: `https://your-app.railway.app/api/health`
   - Test the login flow with Firebase Auth
   - Test a subscription purchase

2. **Configure your domain** (optional):
   - In Railway project settings, add a custom domain
   - Update Firebase Auth authorized domains
   - Update Stripe webhook URLs if using custom domain

### 4. Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (Neon recommended) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_... for production) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `VITE_FIREBASE_API_KEY` | Firebase API key | ✅ |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | ✅ |
| `NODE_ENV` | Set to 'production' for production builds | ⚠️ |

### 5. Troubleshooting

**Build Issues**:
- Ensure all environment variables are set
- Check Railway build logs for specific errors
- Verify Dockerfile syntax

**Database Issues**:
- Ensure DATABASE_URL is correctly formatted
- Run database migrations if needed: `npm run db:push`
- Check Neon database connectivity

**Stripe Issues**:
- Verify webhook endpoint URL is correct
- Check webhook secret matches Railway environment
- Ensure Stripe keys are for the correct environment (test/live)

**Firebase Issues**:
- Add Railway domain to Firebase Auth authorized domains
- Verify Firebase configuration variables are correct

### 6. Monitoring and Maintenance

- Monitor application logs in Railway dashboard
- Set up uptime monitoring for the health endpoint
- Regularly update dependencies for security
- Monitor Stripe webhook delivery in Stripe dashboard

## Development Notes

The application uses:
- Port 5000 (configurable via Railway)
- Health checks at `/api/health`
- Stripe webhooks at `/api/stripe-webhook`
- Firebase Auth for user authentication
- PostgreSQL for data persistence