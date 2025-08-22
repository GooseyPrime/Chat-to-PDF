import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseInitialized = false;
let firebaseInitError: Error | null = null;

// Configuration validation result cache
let configValidationResult: { isValid: boolean; error?: string } | null = null;

// Configuration validation result cache
let configValidationResultFixed: { isValid: boolean; error?: string; projectId?: string } | null = null;

// Validate Firebase configuration before attempting to connect
function validateFirebaseConfig(): { isValid: boolean; error?: string; projectId?: string } {
  if (configValidationResultFixed) {
    return configValidationResultFixed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    configValidationResultFixed = {
      isValid: false,
      error: 'FIREBASE_PROJECT_ID is required. Please set this environment variable to your Firebase project ID.'
    };
    return configValidationResultFixed;
  }

  // Check if we have valid authentication credentials
  const hasGoogleCredentials = !!process.env.GOOGLE_CREDENTIALS;
  const hasIndividualCredentials = !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL);
  
  if (!hasGoogleCredentials && !hasIndividualCredentials) {
    configValidationResultFixed = {
      isValid: false,
      error: 'Firebase authentication credentials are missing. Please set either GOOGLE_CREDENTIALS (recommended) or both FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.'
    };
    return configValidationResultFixed;
  }

  // Validate GOOGLE_CREDENTIALS if provided
  if (hasGoogleCredentials) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
      if (!credentials.project_id || !credentials.private_key || !credentials.client_email) {
        configValidationResultFixed = {
          isValid: false,
          error: 'GOOGLE_CREDENTIALS JSON is missing required fields: project_id, private_key, or client_email.'
        };
        return configValidationResultFixed;
      }
      
      if (credentials.project_id !== projectId) {
        console.warn(`⚠️ Warning: FIREBASE_PROJECT_ID (${projectId}) does not match project_id in GOOGLE_CREDENTIALS (${credentials.project_id}). Using project_id from GOOGLE_CREDENTIALS.`);
      }
    } catch (error) {
      configValidationResultFixed = {
        isValid: false,
        error: 'GOOGLE_CREDENTIALS is not valid JSON. Please ensure it contains the complete Firebase service account JSON.'
      };
      return configValidationResultFixed;
    }
  }

  // Validate individual credentials if provided
  if (hasIndividualCredentials && !hasGoogleCredentials) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!;
    if (!validatePrivateKey(privateKey)) {
      configValidationResultFixed = {
        isValid: false,
        error: 'FIREBASE_PRIVATE_KEY is not in valid PEM format. Ensure it includes -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- markers.'
      };
      return configValidationResultFixed;
    }
  }

  configValidationResultFixed = { isValid: true, projectId };
  return configValidationResultFixed;
}

// Enhanced Firebase connection test with detailed diagnostics
async function testFirestoreConnection(retries = 3): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const db = getFirestore();
      
      // Test 1: Simple listCollections() call
      console.log(`🔍 Testing Firestore connection (attempt ${attempt}/${retries})...`);
      await db.listCollections();
      
      // Test 2: Try to access the app configuration to verify permissions
      const testCollection = db.collection('_connection_test');
      await testCollection.limit(1).get();
      
      console.log('✅ Firestore connection test successful');
      return { success: true };
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorCode = error?.code || 'unknown';
      
      console.error(`❌ Firestore connection test failed (attempt ${attempt}/${retries}):`, {
        code: errorCode,
        message: errorMessage,
        details: error?.details || 'No additional details'
      });

      // Provide specific guidance based on error type
      if (errorCode === 5 || errorMessage.includes('NOT_FOUND')) {
        const guidance = `
🔧 FIRESTORE DATABASE NOT ENABLED (Error 5):
   
   ⚠️  CRITICAL: Your Firebase project exists, but Firestore database is NOT enabled.
   
   🎯 IMMEDIATE ACTION REQUIRED:
   1. Go to: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'your-project'}/firestore
   2. Click the blue "Create database" button
   3. Choose "Start in production mode" (recommended) or "test mode"
   4. Select a region close to your deployment
   5. Wait for database creation to complete
   6. Redeploy your application
   
   ✅ This is the ONLY way to fix Error 5 - you must enable Firestore in Firebase Console.
   
   📋 Your configuration appears correct:
   - Project ID: ${process.env.FIREBASE_PROJECT_ID || 'unknown'}
   - Credentials: ${process.env.GOOGLE_CREDENTIALS ? 'GOOGLE_CREDENTIALS set' : 'Individual credentials'}
   
   🔗 Direct link: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'your-project'}/firestore`;
        
        console.error(guidance);
        
        if (attempt === retries) {
          return { 
            success: false, 
            error: `Firestore database not enabled. Must create database in Firebase Console: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'unknown'}/firestore`
          };
        }
      } else if (errorCode === 7 || errorMessage.includes('PERMISSION_DENIED')) {
        const guidance = `
🔧 Permission Denied (Error 7):
   This usually means:
   1. Service account lacks Firestore permissions
   2. Firestore security rules are too restrictive

   To fix:
   1. In Firebase Console → Project Settings → Service Accounts
   2. Ensure your service account has "Firebase Admin SDK" role
   3. Or go to IAM & Admin and add "Cloud Datastore User" role`;
        
        console.error(guidance);
        
        if (attempt === retries) {
          return { 
            success: false, 
            error: `Permission denied accessing Firestore. Please check service account permissions. ${guidance}`
          };
        }
      } else if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
        console.log(`⏱️ Connection timeout, retrying in ${attempt * 2} seconds...`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
      }

      if (attempt === retries) {
        return { 
          success: false, 
          error: `Connection failed after ${retries} attempts: ${errorMessage}` 
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// Validate Firebase private key format
function validatePrivateKey(privateKey: string): boolean {
  const cleaned = privateKey.replace(/\\n/g, '\n').trim();
  return cleaned.includes('-----BEGIN PRIVATE KEY-----') && 
         cleaned.includes('-----END PRIVATE KEY-----') &&
         cleaned.length > 100; // Basic length check
}

// Initialize Firebase Admin (server-side) - lazy initialization with enhanced error handling
function initializeFirebase(): void {
  if (firebaseInitialized) {
    if (firebaseInitError) {
      throw firebaseInitError;
    }
    return;
  }

  try {
    // Skip initialization if already initialized
    if (admin.apps.length > 0) {
      firebaseInitialized = true;
      return;
    }

    // Validate configuration first
    const configValidation = validateFirebaseConfig();
    if (!configValidation.isValid) {
      throw new Error(`Firebase configuration validation failed: ${configValidation.error}`);
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    console.log(`🔧 Initializing Firebase Admin for project: ${projectId}`);

    // For production with service account
    // Option 1: Use GOOGLE_CREDENTIALS (full service account JSON)
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
          projectId: credentials.project_id,
        });
        
        console.log('✅ Firebase Admin initialized with GOOGLE_CREDENTIALS');
        console.log(`📋 Project: ${credentials.project_id}`);
        console.log(`📧 Service Account: ${credentials.client_email}`);
      } catch (error) {
        throw new Error(
          'GOOGLE_CREDENTIALS is not valid JSON. ' +
          'Ensure it contains the complete Firebase service account JSON from the downloaded key file. ' +
          'See README for detailed setup instructions.'
        );
      }
    }
    // Option 2: Use individual Firebase environment variables
    else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Validate private key format before attempting to use it
      if (!validatePrivateKey(privateKey)) {
        console.error('FIREBASE_PRIVATE_KEY validation failed:');
        console.error('- Key length:', privateKey.length);
        console.error('- Has BEGIN marker:', privateKey.includes('-----BEGIN PRIVATE KEY-----'));
        console.error('- Has END marker:', privateKey.includes('-----END PRIVATE KEY-----'));
        console.error('- First 50 chars:', privateKey.substring(0, 50));
        throw new Error(
          'FIREBASE_PRIVATE_KEY is not in valid PEM format. ' +
          'Ensure it includes -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- markers. ' +
          'For Railway deployment, paste the key exactly as shown in the Firebase JSON file with actual line breaks (not \\n escape sequences). ' +
          'Consider using GOOGLE_CREDENTIALS environment variable instead for easier configuration. ' +
          'See README for detailed formatting instructions.'
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });

      console.log('✅ Firebase Admin initialized with individual variables');
      console.log(`📋 Project: ${projectId}`);
      console.log(`📧 Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);

    } else {
      // Method 3: For development - use Application Default Credentials or project ID only
      admin.initializeApp({
        projectId,
      });
      
      console.log('✅ Firebase Admin initialized with default credentials (development mode)');
      console.log(`📋 Project: ${projectId}`);
    }
    
    firebaseInitialized = true;
  } catch (error) {
    firebaseInitError = error instanceof Error ? error : new Error('Firebase initialization failed');
    console.error('❌ Firebase Admin initialization failed:', firebaseInitError.message);
    throw firebaseInitError;
  }
}

// Get Firestore database instance - with lazy initialization
function getDb() {
  initializeFirebase();
  return getFirestore();
}

export const db = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(target, prop) {
    const actualDb = getDb();
    const value = (actualDb as any)[prop];
    return typeof value === 'function' ? value.bind(actualDb) : value;
  }
});

// Helper to ensure Firestore is ready with comprehensive testing
export const ensureFirestore = async (): Promise<boolean> => {
  try {
    // Initialize Firebase first
    initializeFirebase();
    
    // Test the actual Firestore connection
    const connectionTest = await testFirestoreConnection(3);
    
    if (!connectionTest.success) {
      throw new Error(connectionTest.error || 'Firestore connection test failed');
    }
    
    console.log('🎉 Firestore is ready and accessible');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Firestore connection failed:', errorMessage);
    
    // Log troubleshooting steps
    console.error(`
🔧 FIRESTORE CONNECTION FAILED - Troubleshooting Guide:

${errorMessage.includes('NOT_FOUND') || errorMessage.includes('5') ? 
  `❌ ERROR: Firestore database is NOT ENABLED
  
  🎯 SOLUTION: You must enable Firestore database in Firebase Console
  
  📍 DIRECT ACTION:
  1. Visit: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'your-project'}/firestore
  2. Click "Create database" 
  3. Choose production mode or test mode
  4. Complete the setup wizard
  5. Redeploy your application
  
  ⚠️  This is the ONLY fix for Error 5 - credentials are correct, but database doesn't exist.` 
  :
  errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('7') ?
  `❌ ERROR: Permission denied accessing Firestore
  
  🎯 SOLUTION: Fix service account permissions
  
  📍 DIRECT ACTION:
  1. Firebase Console → Project Settings → Service Accounts
  2. Verify service account has "Firebase Admin SDK" role
  3. Or add "Cloud Datastore User" role in IAM & Admin`
  :
  `❌ ERROR: General Firebase connection issue
  
  🎯 SOLUTION: Verify configuration
  
  📍 STEPS:
  1. Check FIREBASE_PROJECT_ID matches your project
  2. Verify GOOGLE_CREDENTIALS is valid JSON
  3. Ensure project exists in Firebase Console`
}

📊 Configuration Status:
- Project ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}
- Auth Method: ${process.env.GOOGLE_CREDENTIALS ? 'GOOGLE_CREDENTIALS' : process.env.FIREBASE_PRIVATE_KEY ? 'Individual credentials' : 'None'}
- Health Check: Visit /api/health for detailed status

📚 Documentation: See FIREBASE_TROUBLESHOOTING.md for complete guide`);
    
    throw new Error(`Failed to connect to Firestore: ${errorMessage}`);
  }
};