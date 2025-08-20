// server/services/subscriptionManager.ts
import { optimizedStorage } from '../storage/optimizedStorage';
import { stripeService } from './stripeService';
import { nanoid } from 'nanoid';
import { appConfig } from '../config/environment';

interface SubscriptionMetrics {
  totalActive: number;
  totalExpired: number;
  totalRevenue: number;
  planDistribution: Record<string, number>;
  churnRate: number;
  averageLifetime: number;
}

interface UsageAlert {
  userId: string;
  type: 'approaching_limit' | 'limit_exceeded' | 'subscription_expiring';
  message: string;
  actionRequired: boolean;
  metadata: Record<string, any>;
}

interface ProrationCalculation {
  unusedDays: number;
  totalDays: number;
  refundAmount: number;
  currency: string;
}

class SubscriptionManager {
  private alertQueue: UsageAlert[] = [];
  private maxAlertQueue = 1000;

  // Subscription lifecycle management
  async activateSubscription(
    userId: string, 
    planType: string, 
    sessionId: string, 
    customPeriod?: { start: Date; end: Date }
  ): Promise<{ success: boolean; user: any; subscription: any }> {
    try {
      const plan = stripeService.getPlan(planType);
      if (!plan) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const now = new Date();
      const periodStart = customPeriod?.start || now;
      let periodEnd = customPeriod?.end;
      
      if (!periodEnd) {
        periodEnd = this.calculatePeriodEnd(periodStart, plan.interval, plan.intervalCount);
      }

      // Use atomic transaction to activate subscription
      const result = await optimizedStorage.activateSubscriptionAtomic(
        userId,
        planType,
        sessionId,
        (plan.amount / 100).toString(),
        periodStart,
        periodEnd
      );

      // Generate welcome notification
      this.addAlert({
        userId,
        type: 'subscription_expiring',
        message: `Welcome to ${plan.name}! Your subscription is active until ${periodEnd.toLocaleDateString()}.`,
        actionRequired: false,
        metadata: {
          planType,
          periodEnd,
          features: plan.features,
        },
      });

      console.log(`✅ Subscription activated: ${userId} -> ${planType} (expires: ${periodEnd.toISOString()})`);
      
      return {
        success: true,
        user: result.user,
        subscription: result.history,
      };
    } catch (error) {
      console.error(`❌ Failed to activate subscription for ${userId}:`, error);
      throw error;
    }
  }

  async expireSubscription(
    userId: string, 
    reason: 'expired' | 'canceled' | 'payment_failed' | 'admin_action' = 'expired'
  ): Promise<{ success: boolean; user: any }> {
    try {
      const user = await optimizedStorage.expireSubscriptionAtomic(userId, reason);
      
      // Generate expiration notification
      this.addAlert({
        userId,
        type: 'subscription_expiring',
        message: this.getExpirationMessage(reason),
        actionRequired: reason !== 'canceled',
        metadata: {
          reason,
          expiredAt: new Date(),
          previousTier: user.subscriptionTier,
        },
      });

      console.log(`⏰ Subscription expired: ${userId} (reason: ${reason})`);
      
      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error(`❌ Failed to expire subscription for ${userId}:`, error);
      throw error;
    }
  }

  // Usage monitoring and alerts
  async checkUsageLimits(userId: string): Promise<{
    withinLimits: boolean;
    alerts: UsageAlert[];
    recommendations: string[];
  }> {
    try {
      const user = await optimizedStorage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const alerts: UsageAlert[] = [];
      const recommendations: string[] = [];
      let withinLimits = true;

      // Check subscription status
      if (!user.subscriptionTier || user.subscriptionStatus !== 'active') {
        alerts.push({
          userId,
          type: 'limit_exceeded',
          message: 'No active subscription. Please subscribe to generate PDFs.',
          actionRequired: true,
          metadata: { currentStatus: user.subscriptionStatus },
        });
        withinLimits = false;
        recommendations.push('Subscribe to a plan to start generating PDFs');
        return { withinLimits, alerts, recommendations };
      }

      const plan = stripeService.getPlan(user.subscriptionTier);
      if (!plan) {
        console.warn(`Unknown plan type: ${user.subscriptionTier}`);
        return { withinLimits, alerts, recommendations };
      }

      // Check daily usage limits
      if (plan.limits.dailyPdfs > 0) { // -1 means unlimited
        const dailyUsage = await optimizedStorage.getUserDailyUsage(userId);
        const usagePercentage = (dailyUsage / plan.limits.dailyPdfs) * 100;

        if (dailyUsage >= plan.limits.dailyPdfs) {
          alerts.push({
            userId,
            type: 'limit_exceeded',
            message: `Daily limit reached (${dailyUsage}/${plan.limits.dailyPdfs}). Upgrade to Pro for unlimited PDFs.`,
            actionRequired: true,
            metadata: { dailyUsage, dailyLimit: plan.limits.dailyPdfs },
          });
          withinLimits = false;
          recommendations.push('Upgrade to Pro plan for unlimited daily PDFs');
        } else if (usagePercentage >= 80) {
          alerts.push({
            userId,
            type: 'approaching_limit',
            message: `Approaching daily limit: ${dailyUsage}/${plan.limits.dailyPdfs} PDFs used (${Math.round(usagePercentage)}%)`,
            actionRequired: false,
            metadata: { dailyUsage, dailyLimit: plan.limits.dailyPdfs, percentage: usagePercentage },
          });
          recommendations.push('Consider upgrading to Pro for unlimited PDFs');
        }
      }

      // Check subscription expiration
      const activeSubscription = await optimizedStorage.getActiveSubscription(userId);
      if (activeSubscription?.periodEnd) {
        const daysUntilExpiry = Math.ceil(
          (activeSubscription.periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        if (daysUntilExpiry <= 0) {
          alerts.push({
            userId,
            type: 'subscription_expiring',
            message: 'Your subscription has expired. Please renew to continue using the service.',
            actionRequired: true,
            metadata: { expiredAt: activeSubscription.periodEnd },
          });
          withinLimits = false;
          recommendations.push('Renew your subscription to continue generating PDFs');
        } else if (daysUntilExpiry <= 3) {
          alerts.push({
            userId,
            type: 'subscription_expiring',
            message: `Your subscription expires in ${daysUntilExpiry} day(s). Renew now to avoid interruption.`,
            actionRequired: false,
            metadata: { daysUntilExpiry, expiresAt: activeSubscription.periodEnd },
          });
          recommendations.push('Renew your subscription before it expires');
        }
      }

      return { withinLimits, alerts, recommendations };
    } catch (error) {
      console.error(`❌ Error checking usage limits for ${userId}:`, error);
      throw error;
    }
  }

  // Platform restrictions
  async checkPlatformAccess(userId: string, platform: string): Promise<{
    hasAccess: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    try {
      const user = await optimizedStorage.getUser(userId);
      if (!user?.subscriptionTier || user.subscriptionStatus !== 'active') {
        return {
          hasAccess: false,
          reason: 'No active subscription',
          upgradeRequired: true,
        };
      }

      const plan = stripeService.getPlan(user.subscriptionTier);
      if (!plan) {
        return {
          hasAccess: false,
          reason: 'Invalid subscription plan',
          upgradeRequired: true,
        };
      }

      const hasAccess = plan.limits.platforms.includes(platform.toLowerCase());
      
      return {
        hasAccess,
        reason: hasAccess ? undefined : `${platform} not supported on ${plan.name} plan`,
        upgradeRequired: !hasAccess,
      };
    } catch (error) {
      console.error(`❌ Error checking platform access for ${userId}:`, error);
      return {
        hasAccess: false,
        reason: 'Error checking access',
      };
    }
  }

  // Subscription analytics
  async getSubscriptionMetrics(timeframe: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<SubscriptionMetrics> {
    try {
      const stats = await optimizedStorage.getSubscriptionStats();
      
      // Calculate additional metrics (simplified for demo)
      const planDistribution: Record<string, number> = {};
      const plans = stripeService.getAllPlans();
      
      // This would need more complex queries for real metrics
      plans.forEach(plan => {
        planDistribution[plan.id] = Math.floor(Math.random() * 100); // Demo data
      });

      return {
        totalActive: stats.activeSubscriptions,
        totalExpired: stats.expiredSubscriptions,
        totalRevenue: stats.totalRevenue,
        planDistribution,
        churnRate: 0.05, // 5% - would need historical data
        averageLifetime: 45, // days - would need historical data
      };
    } catch (error) {
      console.error('❌ Error getting subscription metrics:', error);
      throw error;
    }
  }

  // Proration calculations for refunds/upgrades
  calculateProration(
    subscriptionStart: Date,
    subscriptionEnd: Date,
    cancelDate: Date,
    paidAmount: number,
    currency: string = 'usd'
  ): ProrationCalculation {
    const totalDays = Math.ceil((subscriptionEnd.getTime() - subscriptionStart.getTime()) / (24 * 60 * 60 * 1000));
    const usedDays = Math.ceil((cancelDate.getTime() - subscriptionStart.getTime()) / (24 * 60 * 60 * 1000));
    const unusedDays = Math.max(0, totalDays - usedDays);
    
    const refundAmount = totalDays > 0 ? (unusedDays / totalDays) * paidAmount : 0;

    return {
      unusedDays,
      totalDays,
      refundAmount: Math.round(refundAmount * 100) / 100, // Round to 2 decimal places
      currency,
    };
  }

  // Alert management
  private addAlert(alert: UsageAlert): void {
    this.alertQueue.push(alert);
    
    // Maintain queue size
    if (this.alertQueue.length > this.maxAlertQueue) {
      this.alertQueue = this.alertQueue.slice(-this.maxAlertQueue / 2);
    }
    
    console.log(`📢 Alert added for user ${alert.userId}: ${alert.message}`);
  }

  getUserAlerts(userId: string, limit: number = 10): UsageAlert[] {
    return this.alertQueue
      .filter(alert => alert.userId === userId)
      .slice(-limit)
      .reverse(); // Most recent first
  }

  clearUserAlerts(userId: string): number {
    const initialLength = this.alertQueue.length;
    this.alertQueue = this.alertQueue.filter(alert => alert.userId !== userId);
    return initialLength - this.alertQueue.length;
  }

  // Utility methods
  private calculatePeriodEnd(start: Date, interval: string, count: number): Date {
    const end = new Date(start);
    
    switch (interval) {
      case 'week':
        end.setDate(end.getDate() + (7 * count));
        break;
      case 'month':
        end.setMonth(end.getMonth() + count);
        break;
      case 'year':
        end.setFullYear(end.getFullYear() + count);
        break;
      default:
        throw new Error(`Invalid interval: ${interval}`);
    }
    
    return end;
  }

  private getExpirationMessage(reason: string): string {
    switch (reason) {
      case 'expired':
        return 'Your subscription has expired. Renew now to continue generating PDFs.';
      case 'canceled':
        return 'Your subscription has been canceled. Thank you for using our service.';
      case 'payment_failed':
        return 'Your subscription was canceled due to payment failure. Please update your payment method and resubscribe.';
      case 'admin_action':
        return 'Your subscription was canceled by an administrator. Please contact support for more information.';
      default:
        return 'Your subscription status has changed. Please check your account for details.';
    }
  }

  // Bulk operations for admin
  async bulkExpireSubscriptions(userIds: string[], reason: string = 'admin_action'): Promise<{
    success: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const results = { success: 0, failed: 0, errors: [] as Array<{ userId: string; error: string }> };
    
    for (const userId of userIds) {
      try {
        await this.expireSubscription(userId, reason as any);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    console.log(`📊 Bulk expiration completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  async generateUsageReport(userId: string): Promise<{
    currentPeriod: {
      dailyUsage: number;
      dailyLimit: number;
      weeklyUsage: number;
      monthlyUsage: number;
    };
    subscription: {
      tier: string | null;
      status: string;
      expiresAt: Date | null;
      daysRemaining: number | null;
    };
    recommendations: string[];
  }> {
    try {
      const user = await optimizedStorage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const dailyUsage = await optimizedStorage.getUserDailyUsage(userId);
      const activityStats = await optimizedStorage.getUserActivityStats(userId);
      const activeSubscription = await optimizedStorage.getActiveSubscription(userId);
      
      const plan = user.subscriptionTier ? stripeService.getPlan(user.subscriptionTier) : null;
      const dailyLimit = plan?.limits.dailyPdfs || 0;
      
      let daysRemaining = null;
      if (activeSubscription?.periodEnd) {
        daysRemaining = Math.ceil(
          (activeSubscription.periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (!user.subscriptionTier) {
        recommendations.push('Subscribe to a plan to start generating PDFs');
      } else if (plan?.limits.dailyPdfs > 0 && dailyUsage / plan.limits.dailyPdfs > 0.8) {
        recommendations.push('Consider upgrading to Pro for unlimited PDFs');
      }
      
      if (daysRemaining !== null && daysRemaining <= 7) {
        recommendations.push('Renew your subscription to avoid service interruption');
      }

      return {
        currentPeriod: {
          dailyUsage,
          dailyLimit,
          weeklyUsage: activityStats.todayPdfs * 7, // Simplified
          monthlyUsage: activityStats.totalPdfs, // Simplified
        },
        subscription: {
          tier: user.subscriptionTier,
          status: user.subscriptionStatus,
          expiresAt: activeSubscription?.periodEnd || null,
          daysRemaining,
        },
        recommendations,
      };
    } catch (error) {
      console.error(`❌ Error generating usage report for ${userId}:`, error);
      throw error;
    }
  }
}

export const subscriptionManager = new SubscriptionManager();