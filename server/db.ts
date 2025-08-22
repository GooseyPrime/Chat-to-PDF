import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side)
if (!admin.apps.length) {
  // For production with service account
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  } else {
    // For development - use Application Default Credentials or project ID only
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
}

// Get Firestore database instance
export const db = getFirestore();

// Helper to ensure Firestore is ready
export const ensureFirestore = async () => {
  try {
    // Test the connection by attempting to get a document that may not exist
    await db.collection('_connection_test').limit(1).get();
    return true;
  } catch (error) {
    console.error('Firestore connection failed:', error);
    throw new Error('Failed to connect to Firestore database');
  }
};