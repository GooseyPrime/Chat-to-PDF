import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, LogOut, Crown } from "lucide-react";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import PdfGenerator from "@/components/PdfGenerator";
import UsageStats from "@/components/UsageStats";
import { signOutUser } from "@shared/firebase";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, firebaseUser, user } = useAuth();

  // Handle payment success and authentication
  useEffect(() => {
    // Check for payment success parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated. You can now generate PDFs.",
        variant: "default",
      });
      // Refresh user data to show updated subscription with more aggressive polling
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-pdfs'] });
      
      // Force multiple refetches with delays to ensure webhook has processed
      const refetchAttempts = [500, 1000, 2000, 5000];
      refetchAttempts.forEach((delay) => {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          queryClient.invalidateQueries({ queryKey: ['/api/user-stats'] });
        }, delay);
      });
      // Clean up URL without page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Redirect to home if not authenticated - Firebase will handle this in App routing
    // No need for manual redirect since App.tsx handles authentication routing
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleLogout = async () => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <FileText className="h-8 w-8 text-red-500 mr-2" />
                <span className="text-xl font-bold text-gray-900">GPTPDF</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {firebaseUser?.photoURL && (
                  <img 
                    src={firebaseUser.photoURL} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-600 font-medium">
                  {firebaseUser?.displayName || firebaseUser?.email || 'User'}
                </span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main PDF Generation Area */}
          <div className="lg:col-span-2">
            <PdfGenerator />
          </div>
          
          {/* Sidebar with Stats */}
          <div className="lg:col-span-1">
            <UsageStats />
          </div>
        </div>
      </div>
    </div>
  );
}
