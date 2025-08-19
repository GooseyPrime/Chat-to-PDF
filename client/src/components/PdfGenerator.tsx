import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, FileText, Lock } from "lucide-react";
import { Link } from "wouter";
import { auth } from "@shared/firebase";

interface PdfRecord {
  id: string;
  originalUrl: string;
  platform: string;
  fileName: string;
  fileSize?: number;
  isWatermarked: boolean;
  processingStatus: string;
  downloadUrl?: string;
  createdAt: string;
}

interface UserStats {
  dailyUsage: number;
  dailyLimit: number;
  totalPdfs: number;
  subscriptionTier: string;
  subscriptionStatus: string;
}

export default function PdfGenerator() {
  const [url, setUrl] = useState("");
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const downloadPdf = async (pdfId: string, fileName: string) => {
    try {
      setDownloadingPdfId(pdfId);
      
      // Get the authentication token
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to download PDFs",
          variant: "destructive",
        });
        return;
      }
      
      const token = await user.getIdToken();
      
      // Fetch the PDF with authentication
      const response = await fetch(`/api/download-pdf/${pdfId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `conversation-${pdfId}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your PDF is downloading",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["/api/user-stats"],
  });

  const { data: recentPdfs } = useQuery<PdfRecord[]>({
    queryKey: ["/api/user-pdfs"],
  });

  const generateMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/generate-pdf", { url });
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingRecordId(data.recordId);
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-pdfs"] });
      toast({
        title: "PDF Generation Started",
        description: "Your PDF is being generated. This may take a few moments.",
      });
    },
    onError: (error: any) => {
      if (error.message.includes("429")) {
        toast({
          title: "Daily Limit Reached",
          description: "Upgrade to Pro for unlimited PDFs.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Platform Not Supported",
          description: "Basic plan supports ChatGPT only. Upgrade to Pro for all platforms.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleGenerate = () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid AI chat URL.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate(url.trim());
  };

  const getPlatformFromUrl = (url: string) => {
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      return 'chatgpt';
    } else if (url.includes('claude.ai')) {
      return 'claude';
    } else if (url.includes('gemini.google.com')) {
      return 'gemini';
    }
    return 'unknown';
  };

  const isPlatformSupported = (url: string) => {
    const platform = getPlatformFromUrl(url);
    
    // Check if subscription is active first
    if (!userStats?.subscriptionTier || userStats.subscriptionStatus !== 'active') {
      return false;
    }
    
    if (userStats.subscriptionTier === 'basic_weekly') {
      return platform === 'chatgpt';
    }
    if (['pro_weekly', 'pro_annual', 'team'].includes(userStats.subscriptionTier)) {
      return ['chatgpt', 'claude', 'gemini'].includes(platform);
    }
    return false;
  };

  const canGenerate = () => {
    // Users need an active subscription to generate PDFs
    if (!userStats?.subscriptionTier || userStats.subscriptionStatus !== 'active') {
      return false;
    }
    if (userStats.subscriptionTier === 'basic_weekly') {
      return userStats.dailyUsage < userStats.dailyLimit;
    }
    return true; // pro and team plans have unlimited usage
  };

  return (
    <div className="space-y-8">
      {/* PDF Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Generate PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="chatUrl">AI Chat URL</Label>
              <Input 
                id="chatUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your ChatGPT, Claude, or Gemini share link here..."
                className="mt-2"
              />
              <div className="mt-2 text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 text-accent mr-1" />
                    ChatGPT
                  </span>
                  <span className={`flex items-center ${userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier ? 'text-gray-400' : 'text-gray-600'}`}>
                    {userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier ? (
                      <Lock className="h-4 w-4 mr-1" />
                    ) : (
                      <FileText className="h-4 w-4 text-accent mr-1" />
                    )}
                    Claude {(userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier) && '(Pro only)'}
                  </span>
                  <span className={`flex items-center ${userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier ? 'text-gray-400' : 'text-gray-600'}`}>
                    {userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier ? (
                      <Lock className="h-4 w-4 mr-1" />
                    ) : (
                      <FileText className="h-4 w-4 text-accent mr-1" />
                    )}
                    Gemini {(userStats?.subscriptionTier === 'basic_weekly' || !userStats?.subscriptionTier) && '(Pro only)'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <Button 
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !canGenerate() || (url.length > 0 && !isPlatformSupported(url))}
                className="h-12"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {!canGenerate() && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                {!userStats?.subscriptionTier ? (
                  <>
                    Subscribe to a plan to generate PDFs! 
                    <Link href="/subscribe" className="ml-1 font-medium underline">
                      Choose Your Plan
                    </Link>
                  </>
                ) : userStats.subscriptionStatus !== 'active' ? (
                  <>
                    Your subscription is {userStats.subscriptionStatus}. 
                    <Link href="/subscribe" className="ml-1 font-medium underline">
                      Renew Your Subscription
                    </Link>
                  </>
                ) : userStats.subscriptionTier === 'basic_weekly' && userStats.dailyUsage >= userStats.dailyLimit ? (
                  <>
                    Daily limit reached! 
                    <Link href="/subscribe" className="ml-1 font-medium underline">
                      Upgrade to Pro
                    </Link> for unlimited PDFs.
                  </>
                ) : (
                  <>
                    Subscription required to generate PDFs.
                    <Link href="/subscribe" className="ml-1 font-medium underline">
                      Subscribe Now
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent PDFs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent PDFs</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!recentPdfs || recentPdfs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No PDFs generated yet. Create your first PDF above!
            </div>
          ) : (
            <div className="space-y-4">
              {recentPdfs.slice(0, 5).map((pdf: PdfRecord) => (
                <div key={pdf.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {pdf.platform.toUpperCase()} Conversation
                      </div>
                      <div className="text-sm text-gray-500">
                        {pdf.processingStatus === 'completed' ? (
                          <>Generated {new Date(pdf.createdAt).toLocaleDateString()}</>
                        ) : (
                          <>Processing...</>
                        )}
                        {pdf.fileSize && (
                          <> • {(pdf.fileSize / 1024 / 1024).toFixed(1)} MB</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {pdf.isWatermarked && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        Watermarked
                      </span>
                    )}
                    {pdf.processingStatus === 'completed' ? (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => downloadPdf(pdf.id, pdf.fileName)}
                        disabled={downloadingPdfId === pdf.id}
                      >
                        {downloadingPdfId === pdf.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
