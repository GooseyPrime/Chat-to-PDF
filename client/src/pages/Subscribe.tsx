import { useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowLeft, Check, Lock } from "lucide-react";
import { Link } from "wouter";
import SubscribeButton from "@/components/SubscribeButton";

export default function Subscribe() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planType: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to a plan.",
        variant: "destructive",
      });
      // Firebase authentication will be handled automatically by the app routing
      window.location.href = "/";
      return;
    }

    setProcessingPlan(planType);

    try {
      const res = await apiRequest("POST", "/api/create-subscription", { planType });
      const data = await res.json();
      console.log("Checkout response:", data);
      
      if (!data.sessionUrl) {
        throw new Error("No checkout URL received from server");
      }
      
      // Add a small delay to ensure state is properly updated before redirect
      setTimeout(() => {
        // Use location.assign instead of location.href for better browser compatibility
        window.location.assign(data.sessionUrl);
      }, 100);
      
    } catch (error) {
      console.error("Subscription creation error:", error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setProcessingPlan(null);
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'basic_weekly':
        return 'Basic Weekly';
      case 'pro_weekly':
        return 'Pro Weekly';
      case 'pro_annual':
        return 'Pro Annual';
      default:
        return 'Subscribe';
    }
  };

  const getPlanPrice = (plan: string) => {
    switch (plan) {
      case 'basic_weekly':
        return '$4.99';
      case 'pro_weekly':
        return '$9.99';
      case 'pro_annual':
        return '$59.99';
      default:
        return '';
    }
  };

  const getPlanFeatures = (plan: string) => {
    switch (plan) {
      case 'basic_weekly':
        return [
          '3 PDFs per day',
          'ChatGPT conversations only',
          'Basic PDF formatting',
          'Watermarked downloads'
        ];
      case 'pro_weekly':
        return [
          'Unlimited PDFs',
          'All platforms (ChatGPT, Claude, Gemini)',
          'Professional PDF formatting',
          'Clean downloads (no watermarks)',
          'Priority support'
        ];
      case 'pro_annual':
        return [
          'Unlimited PDFs',
          'All platforms (ChatGPT, Claude, Gemini)',
          'Professional PDF formatting',
          'Clean downloads (no watermarks)',
          'Priority support',
          'Best value - Save $60/year!'
        ];
      default:
        return [];
    }
  };

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
        <div className="max-w-6xl mx-auto">
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
              Select the plan that best fits your needs. All plans include secure one-time payments with no recurring charges.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Basic Weekly */}
            <Card className="relative border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Basic Weekly
                </CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary">{getPlanPrice('basic_weekly')}</span>
                  <span className="text-gray-600 dark:text-gray-400">/week</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {getPlanFeatures('basic_weekly').map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <SubscribeButton 
                  planType="basic_weekly"
                  planName="Basic Weekly"
                  className="w-full"
                  disabled={processingPlan === 'basic_weekly'}
                >
                  Get Started
                </SubscribeButton>
              </CardContent>
            </Card>

            {/* Pro Weekly */}
            <Card className="relative border-2 border-primary shadow-lg scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Pro Weekly
                </CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary">{getPlanPrice('pro_weekly')}</span>
                  <span className="text-gray-600 dark:text-gray-400">/week</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {getPlanFeatures('pro_weekly').map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <SubscribeButton 
                  planType="pro_weekly"
                  planName="Pro Weekly"
                  className="w-full"
                  disabled={processingPlan === 'pro_weekly'}
                >
                  Upgrade Now
                </SubscribeButton>
              </CardContent>
            </Card>

            {/* Pro Annual */}
            <Card className="relative border-2 hover:border-primary/50 transition-colors">
              <div className="absolute -top-4 right-4">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Best Value
                </span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Pro Annual
                </CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary">{getPlanPrice('pro_annual')}</span>
                  <span className="text-gray-600 dark:text-gray-400">/year</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Save $240 compared to weekly!
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {getPlanFeatures('pro_annual').map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <SubscribeButton 
                  planType="pro_annual"
                  planName="Pro Annual"
                  className="w-full"
                  disabled={processingPlan === 'pro_annual'}
                >
                  Get Best Value
                </SubscribeButton>
              </CardContent>
            </Card>
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