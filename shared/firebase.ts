import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

// Global Firebase configuration state
let app: any = null;
let auth: any = null;
let configPromise: Promise<boolean> | null = null;
let isConfigured = false;
let configurationError: string | null = null;

// Check if Firebase configuration is available from environment variables
const hasEnvConfig = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

// Log configuration status for debugging
console.log('🔧 Firebase Environment Check:', {
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
  hasAppId: !!import.meta.env.VITE_FIREBASE_APP_ID,
  allPresent: hasEnvConfig
});

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
    configurationError = `Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
} else {
  console.log('⚠️ Firebase environment variables not found, will attempt server fallback');
}

// Function to initialize Firebase with dynamic config from server
async function initializeFirebaseFromServer(): Promise<boolean> {
  if (isConfigured) {
    return true; // Already configured
  }

  try {
    console.log('🔄 Attempting to fetch Firebase configuration from server...');
    const response = await fetch('/api/config');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server config request failed:', response.status, errorText);
      configurationError = `Server configuration request failed: ${response.status} ${errorText}`;
      return false;
    }
    
    const configData = await response.json();
    console.log('📡 Server response:', { 
      available: configData.available, 
      hasFirebase: !!configData.firebase,
      reason: configData.reason || 'No reason provided'
    });
    
    if (configData.available && configData.firebase) {
      const firebaseConfig = configData.firebase;
      
      // Validate that we have the essential configuration
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
        console.error('❌ Server provided incomplete Firebase configuration:', firebaseConfig);
        configurationError = 'Server provided incomplete Firebase configuration (missing apiKey, projectId, or appId)';
        return false;
      }
      
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      isConfigured = true;
      
      console.log('✅ Firebase initialized with server configuration');
      return true;
    } else {
      const reason = configData.reason || 'Firebase configuration not available from server';
      console.warn('⚠️ Server cannot provide Firebase configuration:', reason);
      configurationError = reason;
      
      // Log helpful debugging information
      console.log('🔧 Troubleshooting Firebase Configuration:');
      console.log('   1. Check that VITE_FIREBASE_API_KEY is set in environment');
      console.log('   2. Check that VITE_FIREBASE_PROJECT_ID is set in environment');
      console.log('   3. Check that VITE_FIREBASE_APP_ID is set in environment');
      console.log('   4. For Railway: Add these variables in Railway Dashboard → Variables');
      console.log('   5. For local development: Add these to your .env file');
      
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to fetch Firebase configuration from server:', errorMessage);
    configurationError = `Failed to fetch Firebase configuration: ${errorMessage}`;
    
    // Additional troubleshooting for common network errors
    if (errorMessage.includes('fetch')) {
      console.log('🔧 Network Error Troubleshooting:');
      console.log('   - Check that the server is running');
      console.log('   - Check that /api/config endpoint is accessible');
      console.log('   - Check browser network tab for request details');
    }
    
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
    const error = configurationError || 'Firebase authentication is not available. Please check your configuration.';
    console.error('🚫 Sign-in failed:', error);
    
    // Provide user-friendly error message with troubleshooting steps
    if (configurationError?.includes('not available from server')) {
      throw new Error('Authentication service is not configured. Please contact support or check your environment configuration.');
    } else if (configurationError?.includes('fetch')) {
      throw new Error('Unable to connect to authentication service. Please check your internet connection and try again.');
    } else {
      throw new Error(error);
    }
  }
  return signInWithPopup(auth, provider);
};

export const signOutUser = async () => {
  const configured = await ensureFirebaseConfig();
  if (!configured || !auth) {
    const error = configurationError || 'Firebase authentication is not available. Please check your configuration.';
    console.error('🚫 Sign-out failed:', error);
    throw new Error(error);
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

// Export function to get current configuration error for debugging
export const getConfigurationError = (): string | null => {
  return configurationError;
};

// Export function to get detailed configuration status for debugging
export const getConfigurationStatus = () => {
  return {
    isConfigured,
    hasEnvironmentConfig: hasEnvConfig,
    configurationError,
    hasAuth: !!auth,
    hasApp: !!app
  };
};