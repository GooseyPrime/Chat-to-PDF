// server/services/stripeService.ts
import Stripe from 'stripe';
import { stripeConfig, appConfig } from '../config/environment';
import { storage } from '../storage';
import { nanoid } from 'nanoid';

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceId: string;
  amount: number;
  currency: string;
  interval: 'week' | 'month' | 'year';
  intervalCount: number;
  features: string[];
  limits: {
    dailyPdfs: number;
    platforms: string[];
    watermark: boolean;
  };
}

export interface CheckoutSessionData {
  sessionId: string;
  sessionUrl: string;
  planType: string;
  expiresAt: number;
}

class StripeService {
  private stripe: Stripe;
  private plans: Map<string, SubscriptionPlan>;

  constructor() {
    this.stripe = new Stripe(stripeConfig.secretKey);
    this.initializePlans();
  }

  private initializePlans(): void {
    this.plans = new Map([
      ['basic_weekly', {
        id: 'basic_weekly',
        name: 'Basic Weekly',
        priceId: stripeConfig.priceIds.basicWeekly,
        amount: 499, // $4.99
        currency: 'usd',
        interval: 'week',
        intervalCount: 1,
        features: ['3 PDFs per day', 'ChatGPT only', 'Watermarked PDFs'],
        limits: {
          dailyPdfs: 3,
          platforms: ['chatgpt'],
          watermark: true,
        },
      }],
      ['pro_weekly', {
        id: 'pro_weekly',
        name: 'Pro Weekly',
        priceId: stripeConfig.priceIds.proWeekly,
        amount: 999, // $9.99
        currency: 'usd',
        interval: 'week',
        intervalCount: 1,
        features: ['Unlimited PDFs', 'All platforms', 'No watermark', 'Priority support'],
        limits: {
          dailyPdfs: -1, // unlimited
          platforms: ['chatgpt', 'claude', 'gemini'],
          watermark: false,
        },
      }],
      ['pro_annual', {
        id: 'pro_annual',
        name: 'Pro Annual',
        priceId: stripeConfig.priceIds.proAnnual,
        amount: 5999, // $59.99
        currency: 'usd',
        interval: 'year',
        intervalCount: 1,
        features: ['Unlimited PDFs', 'All platforms', 'No watermark', 'Priority support', '5 months free'],
        limits: {
          dailyPdfs: -1, // unlimited
          platforms: ['chatgpt', 'claude', 'gemini'],
          watermark: false,
        },
      }],
    ]);
  }

  async createCheckoutSession(
    userId: string,
    planType: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<CheckoutSessionData> {
    const plan = this.plans.get(planType);
    if (!plan) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        customer_creation: 'always',
        billing_address_collection: 'required',
        phone_number_collection: {
          enabled: true,
        },
        custom_fields: [
          {
            key: 'company',
            label: {
              type: 'custom',
              custom: 'Company (optional)',
            },
            type: 'text',
            optional: true,
          },
        ],
        success_url: successUrl || `${appConfig.clientUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${appConfig.clientUrl}/subscribe?payment=cancelled`,
        metadata: {
          userId: userId,
          planType: planType,
          priceId: plan.priceId,
          userEmail: user.email || '',
          timestamp: Date.now().toString(),
        },
        customer_email: user.email || undefined,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url!,
        planType: planType,
        expiresAt: session.expires_at!,
      };
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error);
      throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifyWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeConfig.webhookSecret
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook verification failed: ${error instanceof Error ? error.message : 'Invalid signature'}`);
    }
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, planType } = session.metadata || {};
    
    if (!userId || !planType) {
      throw new Error(`Missing required metadata in session ${session.id}: userId=${userId}, planType=${planType}`);
    }

    const plan = this.plans.get(planType);
    if (!plan) {
      throw new Error(`Invalid plan type in session ${session.id}: ${planType}`);
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error(`User not found for session ${session.id}: ${userId}`);
    }

    // Calculate subscription period
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, plan.interval, plan.intervalCount);

    // Use database transaction for atomic subscription update
    try {
      await storage.db.transaction(async (tx) => {
        // Update user subscription
        await storage.updateUserSubscriptionTx(tx, userId, planType, 'active');

        // Add subscription history
        await storage.addSubscriptionHistoryTx(tx, {
          userId,
          stripeSubscriptionId: session.id,
          tier: planType,
          status: 'active',
          amount: (plan.amount / 100).toString(),
          currency: plan.currency,
          periodStart: now,
          periodEnd: periodEnd,
        });
      });

      console.log(`✅ Subscription activated: user=${userId}, plan=${planType}, session=${session.id}`);
    } catch (error) {
      console.error(`❌ Failed to activate subscription for session ${session.id}:`, error);
      throw error;
    }
  }

  async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { userId } = paymentIntent.metadata || {};
    
    if (!userId) {
      console.warn(`Payment failed but no userId in metadata: ${paymentIntent.id}`);
      return;
    }

    try {
      await storage.db.transaction(async (tx) => {
        await storage.updateUserSubscriptionTx(tx, userId, '', 'payment_failed');
        
        await storage.addSubscriptionHistoryTx(tx, {
          userId,
          stripeSubscriptionId: paymentIntent.id,
          tier: '',
          status: 'payment_failed',
          amount: '0',
          currency: 'usd',
          periodStart: new Date(),
          periodEnd: new Date(),
        });
      });

      console.log(`💳 Payment failed recorded: user=${userId}, intent=${paymentIntent.id}`);
    } catch (error) {
      console.error(`❌ Failed to record payment failure for ${paymentIntent.id}:`, error);
      throw error;
    }
  }

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

  getPlan(planType: string): SubscriptionPlan | undefined {
    return this.plans.get(planType);
  }

  getAllPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values());
  }

  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error(`Failed to retrieve session ${sessionId}:`, error);
      throw new Error(`Session retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: reason as Stripe.RefundCreateParams.Reason,
        metadata: {
          refund_id: nanoid(),
          timestamp: Date.now().toString(),
        },
      });
    } catch (error) {
      console.error(`Failed to create refund for ${paymentIntentId}:`, error);
      throw new Error(`Refund creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const stripeService = new StripeService();