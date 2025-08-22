# Firebase Connection Troubleshooting Guide

This guide helps resolve common Firebase connection errors encountered during deployment.

## Common Error: `Error: 5 NOT_FOUND`

**Symptoms:**
```
✅ Firebase Admin initialized with GOOGLE_CREDENTIALS
Firestore connection failed: Error: 5 NOT_FOUND:
```

**Root Causes & Solutions:**

### 1. Firestore Database Not Enabled
**Most Common Cause** - The Firebase project exists but Firestore database is not enabled.

**Solution:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database section
4. Click "Create database"
5. Choose either "Start in production mode" or "Start in test mode"
6. Select a region (preferably close to your Railway deployment region)

### 2. Wrong Project ID
The project ID in your credentials doesn't match the actual Firebase project.

**Solution:**
1. Verify `FIREBASE_PROJECT_ID` matches your actual Firebase project ID
2. If using `GOOGLE_CREDENTIALS`, ensure the `project_id` field in the JSON matches
3. Check for typos in project names

### 3. Project Doesn't Exist
The Firebase project was deleted or never created.

**Solution:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Verify the project exists and you have access
3. Create a new project if needed

## Common Error: `Error: 7 PERMISSION_DENIED`

**Symptoms:**
```
Firestore connection failed: Error: 7 PERMISSION_DENIED:
```

**Root Causes & Solutions:**

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