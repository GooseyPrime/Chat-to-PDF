import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { isAuthenticated } from "./firebaseAuth";
import { generatePdf } from "./services/pdfGenerator";
import { insertPdfRecordSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  // Auto-expire subscriptions every hour
  setInterval(async () => {
    try {
      await storage.expireAllExpiredSubscriptions();
    } catch (error) {
      console.error('Scheduled subscription expiration failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
  
  // Stripe webhook - MUST be registered first before any middleware
  // This handles the raw body needed for signature verification
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Using secret from environment
    
    console.log('🔔 Stripe webhook received at:', new Date().toISOString());
    console.log('🔔 Headers:', req.headers);
    console.log('🔔 Signature present:', !!sig);
    console.log('🔔 Body length:', req.body?.length || 0);
    
    // Immediately respond with 200 to avoid redirects
    if (!sig || !req.body) {
      console.error('❌ Missing signature or body');
      return res.status(400).json({ error: 'Missing signature or body' });
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('🎯 Webhook event type:', event.type);
      console.log('🎯 Event ID:', event.id);
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      // Return 200 even on signature failure to prevent retries
      return res.status(200).json({ received: true, error: 'Signature verification failed' });
    }
    
    // Process the event asynchronously to return response immediately
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const planType = session.metadata?.planType;
          
          console.log('💳 Checkout session completed:', session.id);
          console.log('📋 Session metadata:', session.metadata);
          console.log('👤 User ID from metadata:', userId);
          console.log('📦 Plan type from metadata:', planType);
          
          if (!userId || !planType) {
            console.error('❌ Missing metadata in checkout session:', session.id, session.metadata);
            break;
          }
          
          const user = await storage.getUser(userId);
          if (!user) {
            console.error('User not found for checkout session:', session.id);
            break;
          }
          
          // Set tier and status based on plan type and activate the plan
          let tier: string;
          let amount: number;
          let periodDays: number;
          
          switch (planType) {
            case 'basic_weekly':
              tier = 'basic_weekly';
              amount = 4.99;
              periodDays = 7;
              break;
            case 'pro_weekly':
              tier = 'pro_weekly';
              amount = 9.99;
              periodDays = 7;
              break;
            case 'pro_annual':
              tier = 'pro_annual';
              amount = 59.99;
              periodDays = 365;
              break;
            default:
              tier = 'basic_weekly';
              amount = 4.99;
              periodDays = 7;
          }
          
          const updatedUser = await storage.updateUserSubscription(userId, tier, 'active');
          
          // Log subscription history for accounting
          const now = new Date();
          const periodEnd = new Date(now.getTime() + (periodDays * 24 * 60 * 60 * 1000));
          
          await storage.addSubscriptionHistory({
            userId,
            stripeSubscriptionId: session.id,
            tier,
            status: 'active',
            amount: amount.toString(),
            currency: 'usd',
            periodStart: now,
            periodEnd: periodEnd
          });
          
          console.log(`✅ Checkout completed: Updated user ${userId} subscription to ${tier}:active`);
          console.log(`✅ Subscription history logged for period ${periodDays} days`);
          console.log(`✅ User subscription after update:`, {
            id: updatedUser.id,
            email: updatedUser.email,
            subscriptionTier: updatedUser.subscriptionTier,
            subscriptionStatus: updatedUser.subscriptionStatus,
            updatedAt: updatedUser.updatedAt
          });
          
          // Update Stripe customer ID if present
          if (session.customer && typeof session.customer === 'string') {
            await storage.updateUserStripeInfo(userId, session.customer, session.id);
            console.log(`✅ Updated Stripe customer ID for user ${userId}: ${session.customer}`);
          }
          
          break;
          
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          const failedUserId = failedPayment.metadata.userId;
          
          if (failedUserId) {
            await storage.updateUserSubscription(failedUserId, '', 'inactive');
            
            // Log failed payment history
            await storage.addSubscriptionHistory({
              userId: failedUserId,
              stripeSubscriptionId: failedPayment.id,
              tier: '',
              status: 'failed',
              amount: '0',
              currency: 'usd',
              periodStart: new Date(),
              periodEnd: new Date()
            });
            
            console.log(`💳 Payment failed for user ${failedUserId}`);
          }
          
          break;
          
        case 'invoice.payment_succeeded':
          // Handle successful recurring payments (if we add subscriptions later)
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.customer) {
            console.log(`✅ Invoice payment succeeded for customer ${invoice.customer}`);
          }
          
          break;
          
        case 'customer.subscription.deleted':
          // Handle subscription cancellations
          const canceledSub = event.data.object as Stripe.Subscription;
          if (canceledSub.metadata?.userId) {
            await storage.updateUserSubscription(canceledSub.metadata.userId, '', 'canceled');
            console.log(`❌ Subscription canceled for user ${canceledSub.metadata.userId}`);
          }
          
          break;
          
        default:
          console.log(`⚠️ Unhandled webhook event type: ${event.type}`);
      }
      
      // Always return 200 for all webhook events to prevent retries
      res.status(200).json({ received: true, event: event.type });
    } catch (processError) {
      console.error('Error processing webhook:', processError);
      // Still return 200 to prevent Stripe from retrying
      res.status(200).json({ received: true, error: 'Processing failed' });
    }
  });

  // Health check endpoint for Railway
  app.get('/api/health', async (req, res) => {
    try {
      // Test database connectivity
      await db.execute(sql`SELECT 1 as health_check`);
      
      // Check for problematic constraints that cause deployment failures
      let migrationWarning = null;
      let migrationRequired = false;
      
      try {
        const constraintCheck = await db.execute(sql`
          SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique'
        `);
        
        if (Array.isArray(constraintCheck) && constraintCheck.length > 0) {
          migrationWarning = 'users_email_unique constraint exists - may cause authentication failures';
          migrationRequired = true;
          console.warn('⚠️ Health check detected users_email_unique constraint - run migration to fix');
        }
      } catch (constraintError) {
        // If we can't check constraints, it's not critical for health check
        console.warn('Could not check database constraints:', constraintError);
      }
      
      const healthResponse = { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'connected',
        ...(migrationWarning && { 
          warning: migrationWarning,
          migrationRequired,
          migrationScript: 'migrations/fix-railway-deployment.sql'
        })
      };
      
      res.status(200).json(healthResponse);
    } catch (error) {
      console.error('Health check failed - database issue:', error);
      res.status(503).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'disconnected',
        error: 'Database connectivity failed'
      });
    }
  });

  // Migration status endpoint for debugging
  app.get('/api/migration-status', async (req, res) => {
    try {
      // Check for problematic constraints
      const constraintCheck = await db.execute(sql`
        SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique'
      `);
      
      // Check foreign key constraints
      const fkCheck = await db.execute(sql`
        SELECT constraint_name, delete_rule 
        FROM information_schema.referential_constraints 
        WHERE constraint_name IN ('pdf_records_user_id_users_id_fk', 'subscription_history_user_id_users_id_fk')
      `);
      
      // Check email index
      const indexCheck = await db.execute(sql`
        SELECT indexname FROM pg_indexes WHERE indexname = 'users_email_idx'
      `);
      
      const constraintRows = Array.isArray(constraintCheck) ? constraintCheck : [];
      const fkRows = Array.isArray(fkCheck) ? fkCheck : [];
      const indexRows = Array.isArray(indexCheck) ? indexCheck : [];
      
      const migrationStatus = {
        timestamp: new Date().toISOString(),
        checks: {
          users_email_unique_removed: constraintRows.length === 0,
          foreign_keys_have_cascade: fkRows.filter((fk: any) => fk.delete_rule === 'CASCADE').length === fkRows.length,
          email_index_exists: indexRows.length > 0
        },
        details: {
          problematic_constraints: constraintRows.map((c: any) => c.conname),
          foreign_key_constraints: fkRows.map((fk: any) => ({ name: fk.constraint_name, delete_rule: fk.delete_rule })),
          email_index: indexRows.map((i: any) => i.indexname)
        },
        migration_required: constraintRows.length > 0,
        migration_scripts: [
          'migrations/fix-railway-deployment.sql',
          'migrations/app-migration.js (alternative)'
        ]
      };
      
      res.json(migrationStatus);
    } catch (error: any) {
      console.error('Migration status check failed:', error);
      res.status(500).json({ 
        error: 'Failed to check migration status',
        message: error?.message || 'Unknown error'
      });
    }
  });

  // No need for session setup with Firebase Auth

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      // Check if subscription has expired before returning user
      await storage.checkAndUpdateExpiredSubscription(userId);
      
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // One-time payment management
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { planType } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Map plan types to one-time payment Stripe price IDs from environment variables
      const priceMapping = {
        'basic_weekly': {
          priceId: 'price_1Rg6fnJF6bibA8nesbJ1RvxA',
          amount: 499 // $4.99 in cents
        },
        'pro_weekly': {
          priceId: 'price_1Rtf6CJF6bibA8nef9w5LhLE',
          amount: 999 // $9.99 in cents
        },
        'pro_annual': {
          priceId: 'price_1Rtf9YJF6bibA8nemK14siZ5',
          amount: 5999 // $59.99 in cents
        }
      };

      const planConfig = priceMapping[planType as keyof typeof priceMapping];
      if (!planConfig || !planConfig.priceId) {
        console.error(`Missing price ID for plan type: ${planType}`);
        return res.status(400).json({ 
          message: `Price ID not configured for ${planType}. Please contact support.` 
        });
      }

      console.log(`Creating checkout session for plan: ${planType}, price ID: ${planConfig.priceId}`);

      // Create Stripe Checkout session for one-time payment with promo codes
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: planConfig.priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
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
        success_url: `${req.protocol}://${req.get('host')}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscribe?payment=cancelled`,
        metadata: {
          userId: userId,
          planType: planType,
          priceId: planConfig.priceId,
        },
      });

      res.json({
        sessionId: session.id,
        sessionUrl: session.url,
        planType: planType,
      });
    } catch (error: any) {
      console.error('Payment creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint to check subscription status
  app.get('/api/debug/subscription/:userId', async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      const subscriptionHistory = await storage.getUserSubscriptionHistory(userId);
      
      res.json({
        user: user ? {
          id: user.id,
          email: user.email,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionTier: user.subscriptionTier,
          updatedAt: user.updatedAt
        } : null,
        subscriptionHistory: subscriptionHistory.slice(0, 5),
        totalHistory: subscriptionHistory.length
      });
    } catch (error: any) {
      console.error('Debug subscription error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Test endpoint to manually update subscription (for debugging)
  app.post('/api/test-subscription-update', async (req: any, res) => {
    try {
      const { userId, tier, status } = req.body;
      const targetUserId = userId || '29664754'; // Use provided or default to known user
      
      console.log(`🧪 Manually updating subscription for user ${targetUserId} to ${tier}:${status}`);
      
      const updatedUser = await storage.updateUserSubscription(targetUserId, tier || 'pro_weekly', status || 'active');
      console.log(`✅ Test update successful: User ${targetUserId} subscription updated to ${tier}:${status}`);
      console.log('Updated user:', JSON.stringify(updatedUser, null, 2));
      
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error('❌ Test subscription update error:', error);
      res.status(500).json({ message: error.message, error: error.toString() });
    }
  });

  // PDF generation
  app.post('/api/generate-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if subscription has expired first
      await storage.checkAndUpdateExpiredSubscription(userId);
      
      // Refresh user data after potential expiration check
      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check subscription status - users need an active subscription
      if (!updatedUser.subscriptionTier || updatedUser.subscriptionStatus !== 'active') {
        return res.status(403).json({ 
          message: "Please subscribe to a plan to generate PDFs.",
          requiresUpgrade: true 
        });
      }
      
      // Update user reference for subsequent checks
      user = updatedUser;
      
      if (user.subscriptionTier === 'basic_weekly') {
        const dailyUsage = await storage.getUserDailyUsage(userId);
        if (dailyUsage >= 3) {
          return res.status(429).json({ 
            message: "Daily limit reached. Upgrade to Pro for unlimited PDFs.",
            requiresUpgrade: true 
          });
        }
      }

      // Detect platform
      let platform = 'unknown';
      if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
        platform = 'chatgpt';
      } else if (url.includes('claude.ai')) {
        platform = 'claude';
      } else if (url.includes('gemini.google.com')) {
        platform = 'gemini';
      }

      // Check platform restrictions for basic users
      if (user.subscriptionTier === 'basic_weekly' && platform !== 'chatgpt') {
        return res.status(403).json({ 
          message: "Basic plan supports ChatGPT only. Upgrade to Pro for all platforms.",
          requiresUpgrade: true 
        });
      }

      // Create PDF record
      const pdfRecord = await storage.createPdfRecord({
        userId,
        originalUrl: url,
        platform,
        fileName: `chat-export-${Date.now()}.pdf`,
        isWatermarked: user.subscriptionTier === 'basic_weekly',
        processingStatus: 'processing',
      });

      // Start PDF generation with timeout
      Promise.race([
        generatePdf(url, pdfRecord.id, user.subscriptionTier === 'basic_weekly'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timeout after 5 minutes')), 300000)
        )
      ])
        .then(async (result: any) => {
          console.log(`🎉 PDF generation completed for record: ${pdfRecord.id}`);
          await storage.updatePdfRecord(pdfRecord.id, {
            processingStatus: 'completed',
            fileSize: result.size,
            downloadUrl: result.downloadUrl,
            fileName: result.fileName || pdfRecord.fileName,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          
          // Increment usage for basic users
          if (user.subscriptionTier === 'basic_weekly') {
            await storage.incrementUserUsage(userId);
          }
          
          console.log(`✅ PDF record updated successfully: ${pdfRecord.id}`);
        })
        .catch(async (error) => {
          console.error(`❌ PDF generation failed for ${pdfRecord.id}:`, error.message);
          console.error('Full error:', error);
          await storage.updatePdfRecord(pdfRecord.id, {
            processingStatus: 'failed',
          });
          console.log(`💾 PDF record marked as failed: ${pdfRecord.id}`);
        });

      res.json({ 
        message: "PDF generation started",
        recordId: pdfRecord.id 
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Check PDF status
  app.get('/api/pdf-status/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      
      const record = await storage.getPdfRecord(id);
      if (!record || record.userId !== userId) {
        return res.status(404).json({ message: "PDF record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error('PDF status error:', error);
      res.status(500).json({ message: "Failed to get PDF status" });
    }
  });

  // Download PDF
  app.get('/api/download-pdf/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      
      const record = await storage.getPdfRecord(id);
      if (!record || record.userId !== userId) {
        return res.status(404).json({ message: "PDF record not found" });
      }
      
      if (record.processingStatus !== 'completed') {
        return res.status(400).json({ message: "PDF not ready for download" });
      }
      
      // Check if PDF file exists and serve it
      const fs = require('fs');
      const path = require('path');
      
      // Reconstruct file path from record ID
      const filePath = path.join('/tmp', record.fileName || `pdf-${record.id}.pdf`);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on server" });
      }
      
      // Set proper headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
      
      // Stream the PDF file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error: any) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error streaming PDF file" });
        }
      });
      
    } catch (error) {
      console.error('PDF download error:', error);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  // Get user's PDF records
  app.get('/api/user-pdfs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const records = await storage.getUserPdfRecords(userId);
      res.json(records);
    } catch (error) {
      console.error('User PDFs error:', error);
      res.status(500).json({ message: "Failed to get PDF records" });
    }
  });

  // Endpoint to manually expire all expired subscriptions (for admin use)
  app.post('/api/admin/expire-subscriptions', async (req, res) => {
    try {
      const expiredCount = await storage.expireAllExpiredSubscriptions();
      res.json({ message: `Expired ${expiredCount} subscriptions`, expiredCount });
    } catch (error) {
      console.error('Bulk expiration error:', error);
      res.status(500).json({ message: "Failed to expire subscriptions" });
    }
  });

  // Get user stats
  app.get('/api/user-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      // Check expiration before getting stats
      await storage.checkAndUpdateExpiredSubscription(userId);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const dailyUsage = await storage.getUserDailyUsage(userId);
      const totalPdfs = await storage.getUserPdfRecords(userId, 1000);
      
      const getDailyLimit = (tier: string | null) => {
        switch (tier) {
          case 'basic_weekly':
            return 3;
          case 'pro_weekly':
          case 'pro_annual':
          case 'team':
            return -1; // unlimited
          default:
            return 0; // no subscription
        }
      };

      res.json({
        dailyUsage,
        dailyLimit: getDailyLimit(user.subscriptionTier),
        totalPdfs: totalPdfs.length,
        subscriptionTier: user.subscriptionTier || null,
        subscriptionStatus: user.subscriptionStatus,
      });
    } catch (error) {
      console.error('User stats error:', error);
      res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
