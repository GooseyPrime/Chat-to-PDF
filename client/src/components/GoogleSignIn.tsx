import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signOutUser, checkFirebaseAvailability } from "@shared/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Chrome, LogOut, AlertTriangle } from "lucide-react";

export default function GoogleSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated, firebaseUser, isFirebaseAvailable } = useAuth();

  // Check Firebase availability on component mount
  useEffect(() => {
    const checkConfig = async () => {
      try {
        await checkFirebaseAvailability();
      } catch (error) {
        console.error('Error checking Firebase availability:', error);
      } finally {
        setIsCheckingConfig(false);
      }
    };
    
    checkConfig();
  }, []);

  const handleSignIn = async () => {
    if (!isFirebaseAvailable) {
      toast({
        title: "Authentication Unavailable",
        description: "Firebase authentication is not configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Welcome!",
        description: "Successfully signed in with Google.",
      });
    } catch (error: any) {
      console.error("Sign-in error:", error);
      toast({
        title: "Sign-In Failed", 
        description: error.message || "Failed to sign in with Google.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!isFirebaseAvailable) {
      return;
    }

    try {
      await signOutUser();
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      console.error("Sign-out error:", error);
      toast({
        title: "Sign-Out Failed",
        description: error.message || "Failed to sign out.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while checking configuration
  if (isCheckingConfig) {
    return (
      <Button
        disabled={true}
        variant="outline"
        className="gap-2"
        size="sm"
      >
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        Loading...
      </Button>
    );
  }

  // Show degraded state when Firebase is not available
  if (!isFirebaseAvailable) {
    return (
      <Button
        onClick={handleSignIn}
        disabled={true}
        variant="outline"
        className="gap-2"
        size="sm"
      >
        <AlertTriangle className="h-4 w-4" />
        Auth Unavailable
      </Button>
    );
  }

  if (isAuthenticated && firebaseUser) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {firebaseUser.photoURL && (
            <img 
              src={firebaseUser.photoURL} 
              alt="Profile" 
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600">
            {firebaseUser.displayName || firebaseUser.email}
          </span>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      className="gap-2"
      size="sm"
    >
      <Chrome className="h-4 w-4" />
      {isLoading ? "Signing in..." : "Sign in with Google"}
    </Button>
  );
}