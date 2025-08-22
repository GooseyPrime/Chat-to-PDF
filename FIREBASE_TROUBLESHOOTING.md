# Firebase Connection Troubleshooting Guide

This guide helps resolve Firebase connection errors. The application automatically detects issues and provides specific guidance.

## 🔴 CRITICAL: Error 5 NOT_FOUND (Most Common Issue)

**What this means:**
Your Firebase project exists and credentials are correct, but **Firestore database is not enabled**.

**Symptoms in logs:**
```
✅ Firebase Admin initialized with GOOGLE_CREDENTIALS
📋 Project: chat-transcript-converter
📧 Service Account: firebase-adminsdk-fbsvc@chat-transcript-converter.iam.gserviceaccount.com
❌ Firestore connection test failed: { code: 5, message: '5 NOT_FOUND: ' }
```

**🎯 IMMEDIATE FIX REQUIRED:**

1. **Go to Firebase Console:** https://console.firebase.google.com/project/chat-transcript-converter/firestore
2. **Look for "Add database" or "Create database" button** (this confirms Firestore is not enabled)
3. **Click "Create database"**
4. **Choose mode:**
   - "Start in production mode" (recommended for live apps)
   - "Start in test mode" (for development)
5. **Select region** (choose closest to your Railway deployment)
6. **Wait for creation to complete**
7. **Redeploy your Railway application**

**Direct link for this project:** https://console.firebase.google.com/project/chat-transcript-converter/firestore

---

## Configuration Validation

### ✅ Recommended Setup (Currently Used)
```bash
FIREBASE_PROJECT_ID=chat-transcript-converter
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"chat-transcript-converter",...}
```

### Alternative Setup
```bash
FIREBASE_PROJECT_ID=chat-transcript-converter
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@chat-transcript-converter.iam.gserviceaccount.com
```

---

## Other Potential Errors

### Error 7 PERMISSION_DENIED

**Symptoms:**
```
Firestore connection failed: Error: 7 PERMISSION_DENIED:
```

**Solution:**
1. Firebase Console → Project Settings → Service Accounts
2. Ensure service account has "Firebase Admin SDK" role
3. Or add "Cloud Datastore User" role in IAM & Admin

### Invalid Credentials

**Symptoms:**
```
Firebase configuration validation failed: GOOGLE_CREDENTIALS is not valid JSON
```

**Solution:**
1. Re-download service account JSON from Firebase Console
2. Verify JSON is not truncated or corrupted
3. Ensure proper escaping in Railway environment variables

---

## Debugging Steps

### 1. Check Application Health
Visit your app's `/api/health` endpoint for detailed Firebase status.

### 2. Verify Firebase Console Access
1. Go to https://console.firebase.google.com/
2. Confirm you can access the "chat-transcript-converter" project
3. Navigate to Firestore Database section

### 3. Railway Environment Check
1. Railway Dashboard → Project → Variables
2. Confirm `FIREBASE_PROJECT_ID` and `GOOGLE_CREDENTIALS` are set
3. Check Railway logs for detailed error messages

---

## Project-Specific Information

**Your Project ID:** `chat-transcript-converter`
**Service Account:** `firebase-adminsdk-fbsvc@chat-transcript-converter.iam.gserviceaccount.com`
**Firestore Console:** https://console.firebase.google.com/project/chat-transcript-converter/firestore

The application provides real-time diagnostics and will guide you to the exact solution based on the specific error encountered.

### 1. Service Account Lacks Permissions
**Solution:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Ensure your service account has "Firebase Admin SDK" role
3. Or go to Google Cloud Console → IAM & Admin
4. Add "Cloud Datastore User" and "Firebase Admin" roles to the service account

### 2. Firestore Security Rules Too Restrictive
**Solution:**
1. Go to Firebase Console → Firestore → Rules
2. For server-side applications, ensure admin access is allowed
3. Example rule for admin access:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For development only
    }
  }
}
```

## Configuration Validation

### Recommended: Use GOOGLE_CREDENTIALS
```bash
# Railway Environment Variables
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project-id",...}
```

### Alternative: Individual Variables
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Quick Debugging Steps

### 1. Check Health Endpoint
Visit `/api/health` on your deployed application to see detailed Firebase status and troubleshooting information.

### 2. Verify Environment Variables
Ensure all required Firebase environment variables are set in Railway Dashboard.

### 3. Test Firebase Console Access
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project
3. Navigate to Firestore Database
4. Try creating a test document manually

### 4. Validate Service Account JSON
If using `GOOGLE_CREDENTIALS`:
1. Download the service account JSON from Firebase Console
2. Verify it contains: `type`, `project_id`, `private_key`, `client_email`
3. Ensure `project_id` matches your `FIREBASE_PROJECT_ID`

## Regional Configuration

### Firestore Region
When creating Firestore database, choose a region close to your Railway deployment:
- **us-east4** (Northern Virginia) - Common Railway region
- **us-central1** (Iowa) - Firebase default
- **europe-west1** (Belgium) - European deployments

## Environment-Specific Notes

### Railway Deployment
- Set environment variables in Railway Dashboard → Variables
- Use `GOOGLE_CREDENTIALS` with the complete JSON content
- Ensure the JSON is properly formatted (Railway handles multiline JSON)

### Local Development
- Use `.env` file with environment variables
- For development, you can use Application Default Credentials
- Ensure Firebase emulator is not interfering with connections

## Getting Help

If you continue to experience issues:

1. Check the application logs for specific error codes
2. Visit the `/api/health` endpoint for detailed diagnostics
3. Verify your Firebase project settings in the console
4. Contact support with the specific error message and project configuration

## Related Links

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Railway Environment Variables](https://docs.railway.app/guides/variables)