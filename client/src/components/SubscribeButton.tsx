import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle } from "@shared/firebase";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface SubscribeButtonProps {
  planType: string;
  planName: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export default function SubscribeButton({ 
  planType, 
  planName, 
  className, 
  disabled,
  children 
}: SubscribeButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    setIsProcessing(true);

    try {
      // If not authenticated, sign in first
      if (!isAuthenticated) {
        console.log(`Starting subscription flow for ${planName} - authenticating user first`);
        
        try {
          await signInWithGoogle();
          toast({
            title: "Signed in successfully!",
            description: `Proceeding with ${planName} subscription...`,
          });
          
          // Wait a moment for authentication state to update
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (authError: any) {
          console.error("Authentication failed:", authError);
          
          let userMessage = "Sign-In Failed";
          let description = "Failed to sign in with Google.";
          
          if (authError.message?.includes('popup-blocked')) {
            description = "Pop-up was blocked. Please allow pop-ups for this site and try again.";
          } else if (authError.message?.includes('popup-closed-by-user')) {
            description = "Sign-in was cancelled. Please try again.";
          } else if (authError.message?.includes('network')) {
            description = "Network error. Please check your connection and try again.";
          } else if (authError.message?.includes('not configured')) {
            userMessage = "Configuration Error";
            description = "The authentication service is not properly configured. Please contact support.";
          }
          
          toast({
            title: userMessage,
            description,
            variant: "destructive",
          });
          return;
        }
      }

      // Now proceed with subscription creation
      console.log(`Creating subscription for plan: ${planType}`);

      const res = await apiRequest("POST", "/api/create-subscription", { planType });
      const data = await res.json();
      console.log("Checkout response:", data);
      
      if (!data.sessionUrl) {
        throw new Error("No checkout URL received from server");
      }
      
      // Redirect to Stripe checkout
      setTimeout(() => {
        window.location.assign(data.sessionUrl);
      }, 100);
      
    } catch (error) {
      console.error("Subscription creation error:", error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      className={className}
      disabled={disabled || isProcessing}
    >
      {isProcessing ? (
        <>
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
          {isAuthenticated ? 'Processing...' : 'Signing in...'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}