import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, checkFirebaseAvailability } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        const available = await checkFirebaseAvailability();
        setIsFirebaseAvailable(available);
        
        if (available && auth) {
          unsubscribe = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
            setIsLoading(false);
          });
        } else {
          // Firebase is not available, set loading to false
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        setIsFirebaseAvailable(false);
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
  };
}
