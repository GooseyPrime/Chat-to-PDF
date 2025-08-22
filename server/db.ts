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
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Validate private key format before attempting to use it
      if (!validatePrivateKey(privateKey)) {
        throw new Error('FIREBASE_PRIVATE_KEY is not in valid PEM format. Ensure it includes BEGIN/END PRIVATE KEY markers and proper newlines.');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    } else {
      // For development - use Application Default Credentials or project ID only
      admin.initializeApp({
        projectId,
      });
    }
    
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
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
    // Test the connection by attempting to get a document that may not exist
    await actualDb.collection('_connection_test').limit(1).get();
    return true;
  } catch (error) {
    console.error('Firestore connection failed:', error);
    throw new Error(`Failed to connect to Firestore database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};