import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, checkFirebaseAvailability, getConfigurationError, getConfigurationStatus } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        const available = await checkFirebaseAvailability();
        setIsFirebaseAvailable(available);
        
        if (available && auth) {
          console.log('✅ Firebase available, setting up auth state listener');
          unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('👤 Auth state changed:', user ? `User: ${user.email}` : 'No user');
            setFirebaseUser(user);
            setIsLoading(false);
          });
        } else {
          // Firebase is not available, capture error details
          const error = getConfigurationError();
          const status = getConfigurationStatus();
          
          console.warn('⚠️ Firebase not available:', { error, status });
          setConfigError(error);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        setIsFirebaseAvailable(false);
        setConfigError(error instanceof Error ? error.message : 'Firebase initialization failed');
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Get user data from our database
  const { data: dbUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!firebaseUser && isFirebaseAvailable,
  });

  return {
    user: dbUser,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser && isFirebaseAvailable,
    isFirebaseAvailable,
    configError, // Export configuration error for UI components to display
  };
}
