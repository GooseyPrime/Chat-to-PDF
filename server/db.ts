import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseInitialized = false;
let firebaseInitError: Error | null = null;

// Validate Firebase private key format
function validatePrivateKey(privateKey: string): boolean {
  const cleaned = privateKey.replace(/\\n/g, '\n').trim();
  return cleaned.includes('-----BEGIN PRIVATE KEY-----') && 
         cleaned.includes('-----END PRIVATE KEY-----') &&
         cleaned.length > 100; // Basic length check
}

// Initialize Firebase Admin (server-side) - lazy initialization
function initializeFirebase(): void {
  if (firebaseInitialized) {
    if (firebaseInitError) {
      throw firebaseInitError;
    }
    return;
  }

  try {
    if (admin.apps.length > 0) {
      firebaseInitialized = true;
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID is required');
    }


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

    } else {
      // Method 3: For development - use Application Default Credentials or project ID only
      admin.initializeApp({
        projectId,
      });
      
      console.log('✅ Firebase Admin initialized with default credentials (development mode)');
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

// Helper to ensure Firestore is ready
export const ensureFirestore = async (): Promise<boolean> => {
  try {
    initializeFirebase();
    const actualDb = getDb();
    // Test the connection by listing collections (lightweight operation that doesn't require specific collections)
    await actualDb.listCollections();
    return true;
  } catch (error) {
    console.error('Firestore connection failed:', error);
    throw new Error(`Failed to connect to Firestore database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};