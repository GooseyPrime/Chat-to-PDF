# Windows PowerShell Deployment Guide for Chat-to-PDF

This guide provides step-by-step instructions for deploying Chat-to-PDF to Railway using Windows PowerShell.

## Quick Reference

### Required Environment Variables for Railway Dashboard

Copy these to Railway Dashboard → Variables:

**Note:** For SESSION_SECRET, generate a secure 32-character string using:
```powershell
# Windows PowerShell method
[System.Web.Security.Membership]::GeneratePassword(32, 0)
```

```
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
NODE_ENV=production
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters
STORAGE_PATH=/app/storage
```

### PowerShell Commands Summary

```powershell
# Download and setup
cd C:\
git clone https://github.com/GooseyPrime/Chat-to-PDF.git chat-to-pdf
cd C:\chat-to-pdf

# Install Railway CLI
npm install -g @railway/cli

# Install dependencies
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
npm install

# Build and test locally
npm run build

# Deploy to Railway
railway login
railway init
railway add postgresql
railway up

# Monitor deployment
railway logs
railway domain
```

### Common Issues and Solutions

1. **PowerShell Execution Policy Error**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Git not found**:
   - Install Git for Windows from https://git-scm.com/download/win

3. **Node.js not found**:
   - Install Node.js 20+ from https://nodejs.org/

4. **Railway CLI not found**:
   ```powershell
   npm install -g @railway/cli
   ```

5. **Chrome/Puppeteer download issues**:
   ```powershell
   $env:PUPPETEER_SKIP_DOWNLOAD = "true"
   $env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
   npm install
   ```

### Post-Deployment Checklist

- [ ] All environment variables set in Railway dashboard
- [ ] Stripe webhook configured with Railway URL
- [ ] Firebase authorized domains include Railway domain
- [ ] Database migration completed
- [ ] Health endpoint returns healthy status
- [ ] Test authentication and PDF generation

For complete instructions, see the main README.md file.