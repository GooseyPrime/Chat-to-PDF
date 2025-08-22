import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

// Check if Firebase configuration is available
const hasFirebaseConfig = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize Firebase if configuration is available
let app: any = null;
let auth: any = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
} else {
  console.warn('Firebase configuration missing. Authentication features will be disabled.');
}

export { auth };

const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');

export const signInWithGoogle = () => {
  if (!auth) {
    throw new Error('Firebase authentication is not available. Please check your configuration.');
  }
  return signInWithPopup(auth, provider);
};

export const signOutUser = () => {
  if (!auth) {
    throw new Error('Firebase authentication is not available. Please check your configuration.');
  }
  return signOut(auth);
};

export type FirebaseUser = User;

// Export configuration status for components to check
export const isFirebaseAvailable = hasFirebaseConfig && !!auth;