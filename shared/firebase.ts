import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

// Global Firebase configuration state
let app: any = null;
let auth: any = null;
let configPromise: Promise<boolean> | null = null;
let isConfigured = false;

// Check if Firebase configuration is available from environment variables
const hasEnvConfig = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

// Initialize Firebase with static config if available
if (hasEnvConfig) {
  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    isConfigured = true;
    console.log('✅ Firebase initialized with environment variables');
  } catch (error) {
    console.error('❌ Firebase initialization failed with environment config:', error);
  }
}

// Function to initialize Firebase with dynamic config from server
async function initializeFirebaseFromServer(): Promise<boolean> {
  if (isConfigured) {
    return true; // Already configured
  }

  try {
    const response = await fetch('/api/config');
    const configData = await response.json();
    
    if (configData.available && configData.firebase) {
      const firebaseConfig = configData.firebase;
      
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      isConfigured = true;
      
      console.log('✅ Firebase initialized with server configuration');
      return true;
    } else {
      console.warn('⚠️ Firebase configuration not available from server:', configData.reason);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to fetch Firebase configuration from server:', error);
    return false;
  }
}

// Initialize Firebase configuration (only attempt once)
async function ensureFirebaseConfig(): Promise<boolean> {
  if (isConfigured) {
    return true;
  }
  
  if (!configPromise) {
    configPromise = initializeFirebaseFromServer();
  }
  
  return await configPromise;
}

export { auth };

const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');

export const signInWithGoogle = async () => {
  const configured = await ensureFirebaseConfig();
  if (!configured || !auth) {
    throw new Error('Firebase authentication is not available. Please check your configuration.');
  }
  return signInWithPopup(auth, provider);
};

export const signOutUser = async () => {
  const configured = await ensureFirebaseConfig();
  if (!configured || !auth) {
    throw new Error('Firebase authentication is not available. Please check your configuration.');
  }
  return signOut(auth);
};

export type FirebaseUser = User;

// Export configuration status for components to check
export const isFirebaseAvailable = isConfigured;

// Export function to check if Firebase is available (async)
export const checkFirebaseAvailability = async (): Promise<boolean> => {
  return await ensureFirebaseConfig();
};