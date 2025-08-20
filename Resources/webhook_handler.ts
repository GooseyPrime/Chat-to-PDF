// server/handlers/webhookHandler.ts
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripeService } from '../services/stripeService';
import { storage } from '../storage';
import { nanoid } from 'nanoid';

interface WebhookLogEntry {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class WebhookHandler {
  private processedEvents = new Set<string>();
  private eventLog: WebhookLogEntry[] = [];
  private maxLogSize = 1000;

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    
    // Early validation
    if (!signature) {
      console.error('❌ Webhook signature missing');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    if (!req.body || req.body.length === 0) {
      console.error('❌ Webhook body empty');
      res.status(400).json({ error: 'Empty body' });
      return;
    }

    const startTime = Date.now();
    let event: Stripe.Event;
    let logEntry: WebhookLogEntry;

    try {
      // Verify webhook signature
      event = await stripeService.verifyWebhook(req.body, signature);
      
      // Create log entry
      logEntry = {
        id: nanoid(),
        eventId: event.id,
        eventType: event.type,
        processed: false,
        timestamp: new Date(),
        metadata: {
          livemode: event.livemode,
          apiVersion: event.api_version,
          requestId: event.request?.id,
        },
      };

      console.log(`🔔 Webhook received: ${event.type} (${event.id})`);

      // Check for duplicate events
      if (this.processedEvents.has(event.id)) {
        console.log(`⚠️ Duplicate event ignored: ${event.id}`);
        res.status(200).json({ 
          received: true, 
          status: 'duplicate',
          eventId: event.id 
        });
        return;
      }

      // Process event based on type
      await this.processEvent(event, logEntry);

      // Mark as processed
      this.processedEvents.add(event.id);
      logEntry.processed = true;
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Webhook processed: ${event.type} in ${processingTime}ms`);

      res.status(200).json({
        received: true,
        status: 'processed',
        eventId: event.id,
        eventType: event.type,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Webhook processing failed: ${errorMessage}`);
      console.error('Error details:', error);

      if (logEntry!) {
        logEntry.error = errorMessage;
        logEntry.processed = false;
      }

      res.status(400).json({
        error: 'Webhook processing failed',
        message: errorMessage,
        processingTime,
      });
    } finally {
      // Add to log and manage log size
      if (logEntry!) {
        this.addToLog(logEntry);
      }

      // Clean up old processed events (keep last 10000)
      if (this.processedEvents.size > 10000) {
        const eventsArray = Array.from(this.processedEvents);
        const toKeep = eventsArray.slice(-5000);
        this.processedEvents.clear();
        toKeep.forEach(id => this.processedEvents.add(id));
      }
    }
  }

  private async processEvent(event: Stripe.Event, logEntry: WebhookLogEntry): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, logEntry);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent, logEntry);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, logEntry);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, logEntry);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription, logEntry);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription, logEntry);
        break;

      default:
        console.log(`⚠️ Unhandled webhook event: ${event.type}`);
        logEntry.metadata = { 
          ...logEntry.metadata, 
          status: 'unhandled',
          reason: 'Event type not implemented'
        };
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    try {
      await stripeService.handleCheckoutCompleted(session);
      
      logEntry.metadata = {
        ...logEntry.metadata,
        sessionId: session.id,
        userId: session.metadata?.userId,
        planType: session.metadata?.planType,
        amount: session.amount_total,
        currency: session.currency,
      };

      console.log(`💳 Checkout completed: session=${session.id}, user=${session.metadata?.userId}`);
    } catch (error) {
      console.error(`❌ Checkout completion failed for session ${session.id}:`, error);
      throw error;
    }
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    try {
      await stripeService.handlePaymentFailed(paymentIntent);
      
      logEntry.metadata = {
        ...logEntry.metadata,
        paymentIntentId: paymentIntent.id,
        userId: paymentIntent.metadata?.userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        failureCode: paymentIntent.last_payment_error?.code,
        failureMessage: paymentIntent.last_payment_error?.message,
      };

      console.log(`💳 Payment failed: intent=${paymentIntent.id}, user=${paymentIntent.metadata?.userId}`);
    } catch (error) {
      console.error(`❌ Payment failure handling failed for ${paymentIntent.id}:`, error);
      throw error;
    }
  }

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    logEntry.metadata = {
      ...logEntry.metadata,
      paymentIntentId: paymentIntent.id,
      userId: paymentIntent.metadata?.userId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };

    console.log(`💰 Payment succeeded: intent=${paymentIntent.id}, user=${paymentIntent.metadata?.userId}`);
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    logEntry.metadata = {
      ...logEntry.metadata,
      invoiceId: invoice.id,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    };

    console.log(`📄 Invoice payment succeeded: invoice=${invoice.id}, customer=${invoice.customer}`);
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    
    if (userId) {
      try {
        await storage.updateUserSubscription(userId, '', 'canceled');
        
        await storage.addSubscriptionHistory({
          userId,
          stripeSubscriptionId: subscription.id,
          tier: '',
          status: 'canceled',
          amount: '0',
          currency: 'usd',
          periodStart: new Date(),
          periodEnd: new Date(),
        });

        console.log(`❌ Subscription canceled: subscription=${subscription.id}, user=${userId}`);
      } catch (error) {
        console.error(`❌ Subscription cancellation handling failed:`, error);
        throw error;
      }
    }

    logEntry.metadata = {
      ...logEntry.metadata,
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      userId: userId,
      status: subscription.status,
    };
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription, 
    logEntry: WebhookLogEntry
  ): Promise<void> {
    logEntry.metadata = {
      ...logEntry.metadata,
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      userId: subscription.metadata?.userId,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    };

    console.log(`🔄 Subscription updated: subscription=${subscription.id}, status=${subscription.status}`);
  }

  private addToLog(entry: WebhookLogEntry): void {
    this.eventLog.push(entry);
    
    // Maintain log size
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize / 2);
    }
  }

  getEventLog(limit: number = 50): WebhookLogEntry[] {
    return this.eventLog
      .slice(-limit)
      .reverse(); // Most recent first
  }

  getEventStats(): {
    total: number;
    processed: number;
    failed: number;
    byType: Record<string, number>;
  } {
    const stats = {
      total: this.eventLog.length,
      processed: 0,
      failed: 0,
      byType: {} as Record<string, number>,
    };

    this.eventLog.forEach(entry => {
      if (entry.processed) stats.processed++;
      if (entry.error) stats.failed++;
      
      stats.byType[entry.eventType] = (stats.byType[entry.eventType] || 0) + 1;
    });

    return stats;
  }

  clearEventLog(): void {
    this.eventLog = [];
    console.log('🧹 Webhook event log cleared');
  }
}

export const webhookHandler = new WebhookHandler();