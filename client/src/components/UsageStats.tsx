import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, Crown } from "lucide-react";
import { Link } from "wouter";

interface UserStats {
  dailyUsage: number;
  dailyLimit: number;
  totalPdfs: number;
  subscriptionTier: string;
  subscriptionStatus: string;
}

export default function UsageStats() {
  const { data: stats } = useQuery<UserStats>({
    queryKey: ["/api/user-stats"],
  });

  if (!stats) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const usagePercentage = stats.dailyLimit === -1 ? 0 : (stats.dailyUsage / stats.dailyLimit) * 100;

  return (
    <div className="space-y-4">
      {/* Daily Usage */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                ['pro_weekly', 'pro_annual', 'team'].includes(stats.subscriptionTier)
                  ? 'text-blue-700 bg-blue-100' 
                  : stats.subscriptionTier === 'basic_weekly'
                  ? 'text-yellow-700 bg-yellow-100'
                  : 'text-red-700 bg-red-100'
              }`}>
                {stats.subscriptionTier === 'pro_weekly' ? 'Pro Weekly' :
                 stats.subscriptionTier === 'pro_annual' ? 'Pro Annual' :
                 stats.subscriptionTier === 'basic_weekly' ? 'Basic' :
                 stats.subscriptionTier === 'team' ? 'Team' : 'No Plan'}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900">
              {stats.dailyLimit === -1 ? stats.dailyUsage : `${stats.dailyUsage}/${stats.dailyLimit}`}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              PDFs Today
            </div>
          </div>
          {stats.dailyLimit !== -1 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Total PDFs */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">This Month</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalPdfs}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Total PDFs
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Subscription Status */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Crown className="h-5 w-5 text-purple-600" />
              </div>
              {(!stats.subscriptionTier || stats.subscriptionTier === 'basic_weekly') && (
                <Link href="/subscribe">
                  <Button size="sm" variant="ghost" className="text-xs">
                    {!stats.subscriptionTier ? 'Subscribe' : 'Upgrade'}
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900">
              {stats.subscriptionTier === 'pro_weekly' ? 'Pro Weekly' :
               stats.subscriptionTier === 'pro_annual' ? 'Pro Annual' :
               stats.subscriptionTier === 'basic_weekly' ? 'Basic' :
               stats.subscriptionTier === 'team' ? 'Team' : 'No Plan'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {!stats.subscriptionTier ? 'Subscribe to get started' : 'Current Plan'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
