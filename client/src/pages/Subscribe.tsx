import { useEffect, useState } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Lock } from "lucide-react";
import { Link } from "wouter";

export default function Subscribe() {
  const { isAuthenticated, firebaseUser, isLoading } = useAuth();
  const [pricingTableLoaded, setPricingTableLoaded] = useState(false);

  // Load Stripe pricing table script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    script.onload = () => setPricingTableLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Link href="/">
              <Button variant="ghost" className="mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary mr-3" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Choose Your Plan</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Select the plan that best fits your needs. All plans include secure checkout powered by Stripe.
            </p>
          </div>

          {/* Authentication Notice */}
          {!isAuthenticated && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
              <p className="text-blue-800 dark:text-blue-200 text-center">
                Please log in to subscribe to a plan. You'll be redirected to authenticate before checkout.
              </p>
            </div>
          )}

          {/* Stripe Pricing Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            {!pricingTableLoaded && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mr-3" />
                <span className="text-gray-600 dark:text-gray-400">Loading pricing options...</span>
              </div>
            )}
            
            <stripe-pricing-table 
              pricing-table-id="prctbl_1RtfEmJF6bibA8neXrRMo3a"
              publishable-key={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_live_0TqCIG6cqKBt1QeIrGVHglz"}
              client-reference-id={firebaseUser?.uid || "anonymous"}
              customer-email={firebaseUser?.email || ""}
            />
            
            {/* Note about authentication */}
            {!isAuthenticated && pricingTableLoaded && (
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm text-center">
                  <strong>Note:</strong> You'll be prompted to log in during checkout to complete your subscription.
                </p>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="text-center">
            <div className="flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
              <Lock className="w-4 h-4 mr-2" />
              Secure checkout powered by Stripe. All payments are encrypted and protected.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}