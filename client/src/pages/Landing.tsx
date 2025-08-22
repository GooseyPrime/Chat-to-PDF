import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Sparkles, Rocket, Shield, Check, CheckCircle } from "lucide-react";
import GoogleSignIn from "@/components/GoogleSignIn";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check for payment success parameter
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    
    if (paymentStatus === 'success' && sessionId) {
      setShowPaymentSuccess(true);
      console.log('Payment successful with session ID:', sessionId);
      
      // Clear URL parameters after showing success message
      const timer = setTimeout(() => {
        setShowPaymentSuccess(false);
        window.history.replaceState({}, '', window.location.pathname);
        
        // If user is authenticated, redirect to dashboard
        if (isAuthenticated) {
          navigate('/');
        }
      }, 4000); // Show success message for 4 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate]);

  const handleGetStarted = () => {
    // Google Sign-In will handle the authentication
    console.log('Get started clicked - authentication handled by GoogleSignIn component');
  };

  const handleLogin = () => {
    // Google Sign-In will handle the authentication
    console.log('Login clicked - authentication handled by GoogleSignIn component');
  };

  const handleSubscribe = async (planType: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to a plan.",
        variant: "destructive",
      });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Payment Success Banner */}
      {showPaymentSuccess && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-3">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-800 font-medium">
                Payment successful! Your subscription is now active.
              </span>
            </div>
          </div>
        </div>
      )}
      
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
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <GoogleSignIn />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
              Convert AI Chats to{" "}
              <span className="text-primary">Clean PDFs</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your ChatGPT, Claude, and Gemini conversations into professionally formatted PDF documents. No clutter, no ads, just clean readable content.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex justify-center">
                <GoogleSignIn />
              </div>
              <Button size="lg" variant="outline" className="text-lg px-8 py-3">
                View Sample PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose GPTPDF?</h2>
            <p className="text-lg text-gray-600">Professional PDF conversion with enterprise-grade quality</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Clean Formatting</h3>
                <p className="text-gray-600">Removes ads, buttons, and clutter for professional-looking documents</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Platform</h3>
                <p className="text-gray-600">Supports ChatGPT, Claude, and Gemini chat exports</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Private</h3>
                <p className="text-gray-600">Your data is processed securely and never stored permanently</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-gray-600">Choose the plan that works for you</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Basic Weekly Plan */}
            <Card className="border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Basic</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    $4.99<span className="text-base font-normal">/week</span>
                  </div>
                  <p className="text-gray-600 text-sm">Perfect for occasional use</p>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>3 PDFs per day</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>ChatGPT only</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>25-30 message limit</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Watermarked PDFs</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Queue-based processing</span>
                  </li>
                </ul>
                <div className="w-full flex justify-center">
                  {isAuthenticated ? (
                    <Button 
                      onClick={() => handleSubscribe('basic_weekly')}
                      className="w-full"
                      disabled={processingPlan === 'basic_weekly'}
                    >
                      {processingPlan === 'basic_weekly' ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Get Started'
                      )}
                    </Button>
                  ) : (
                    <GoogleSignIn />
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Pro Monthly Plan */}
            <Card className="border-2 border-primary relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-semibold">Most Popular</span>
              </div>
              <CardContent className="p-6 bg-primary text-white">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">Pro Monthly</h3>
                  <div className="text-3xl font-bold mb-2">
                    $9.99<span className="text-base font-normal">/month</span>
                  </div>
                  <p className="text-blue-100 text-sm">For power users</p>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Unlimited PDFs</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>All platforms</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>No watermarks</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Priority processing</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Custom titles & notes</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Markdown export</span>
                  </li>
                </ul>
                <div className="w-full flex justify-center">
                  {isAuthenticated ? (
                    <Button 
                      onClick={() => handleSubscribe('pro_weekly')}
                      className="w-full bg-white text-primary hover:bg-gray-50"
                      disabled={processingPlan === 'pro_weekly'}
                    >
                      {processingPlan === 'pro_weekly' ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Upgrade Now'
                      )}
                    </Button>
                  ) : (
                    <GoogleSignIn />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pro Annual Plan */}
            <Card className="border-2 border-green-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">Best Value</span>
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pro Annual</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    $59.99<span className="text-base font-normal">/year</span>
                  </div>
                  <div className="text-sm text-green-600 font-medium mb-2">Save 50%</div>
                  <p className="text-gray-600 text-sm">Best for professionals</p>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Everything in Pro Monthly</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Version history</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Folder organization</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Private share links</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Professional formatting</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-accent mr-2" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <div className="w-full flex justify-center">
                  {isAuthenticated ? (
                    <Button 
                      onClick={() => handleSubscribe('pro_annual')}
                      className="w-full"
                      disabled={processingPlan === 'pro_annual'}
                    >
                      {processingPlan === 'pro_annual' ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Get Best Value'
                      )}
                    </Button>
                  ) : (
                    <GoogleSignIn />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
