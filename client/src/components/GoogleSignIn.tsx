import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signOutUser } from "@shared/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Chrome, LogOut } from "lucide-react";

export default function GoogleSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, firebaseUser } = useAuth();

  const handleSignIn = async () => {
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