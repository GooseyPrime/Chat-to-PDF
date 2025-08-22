import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseAvailable } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseAvailable || !auth) {
      // Firebase is not available, set loading to false
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
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
