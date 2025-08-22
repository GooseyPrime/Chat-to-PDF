import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signOutUser, checkFirebaseAvailability, getConfigurationError } from "@shared/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Chrome, LogOut, AlertTriangle, Settings } from "lucide-react";

export default function GoogleSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated, firebaseUser, isFirebaseAvailable, configError } = useAuth();

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
      const error = configError || getConfigurationError() || "Firebase authentication is not configured";
      
      // Show user-friendly error message
      let userMessage = "Authentication service is not available.";
      let description = "Please contact support for assistance.";
      
      if (error.includes('Missing environment variables')) {
        userMessage = "Service Configuration Error";
        description = "The authentication service is not properly configured. Please contact support.";
      } else if (error.includes('fetch') || error.includes('network')) {
        userMessage = "Connection Error";
        description = "Unable to connect to authentication service. Please check your connection and try again.";
      }
      
      toast({
        title: userMessage,
        description,
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
      
      // Parse Firebase auth errors for better user messages
      let userMessage = "Sign-In Failed";
      let description = "Failed to sign in with Google.";
      
      if (error.message?.includes('auth/popup-blocked')) {
        description = "Pop-up was blocked. Please allow pop-ups for this site and try again.";
      } else if (error.message?.includes('auth/popup-closed-by-user')) {
        description = "Sign-in was cancelled. Please try again.";
      } else if (error.message?.includes('auth/network-request-failed')) {
        description = "Network error. Please check your connection and try again.";
      } else if (error.message?.includes('not available')) {
        description = "Authentication service is not configured properly.";
      } else {
        description = error.message || description;
      }
      
      toast({
        title: userMessage,
        description,
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
    const errorSummary = configError || getConfigurationError() || "Configuration missing";
    const isConfigIssue = errorSummary.includes('Missing environment variables') || 
                         errorSummary.includes('not available from server');
    
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={() => {
            // Show detailed error when user clicks
            const error = configError || getConfigurationError() || "Authentication service is not configured";
            toast({
              title: "Authentication Service Unavailable",
              description: isConfigIssue ? 
                "The authentication service is not properly configured. Please contact support." :
                "Unable to connect to authentication service. Please try again later.",
              variant: "destructive",
              duration: 5000,
            });
          }}
          disabled={false}
          variant="outline"
          className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
          size="sm"
        >
          <Settings className="h-4 w-4" />
          Auth Unavailable
        </Button>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 max-w-xs text-center">
            Dev: {errorSummary.substring(0, 50)}...
          </div>
        )}
      </div>
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