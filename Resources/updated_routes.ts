// server/routes.ts
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { stripeService } from "./services/stripeService";
import { webhookHandler } from "./handlers/webhookHandler";
import { authService, requireAuth, optionalAuth, requireAdmin } from "./services/authService";
import { optimizedStorage } from "./storage/optimizedStorage";
import { generatePdf } from "./services/pdfGenerator";
import { nanoid } from "nanoid";
import { appConfig } from "./config/environment";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: appConfig.nodeEnv,
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Stripe webhook - MUST be before any JSON parsing middleware
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), 
    webhookHandler.handleStripeWebhook.bind(webhookHandler)
  );

  // Auto-expire subscriptions every hour
  setInterval(async () => {
    try {
      const result = await optimizedStorage.expireAllExpiredSubscriptionsAtomic();
      if (result.expiredCount > 0) {
        console.log(`⏰ Scheduled expiration: ${result.expiredCount} subscriptions expired`);
      }
    } catch (error) {
      console.error('❌ Scheduled subscription expiration failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Authentication routes
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      // Check if subscription has expired before returning user
      await optimizedStorage.checkAndUpdateExpiredSubscription(userId);
      
      const user = await optimizedStorage.getUser(userId);
      const stats = await optimizedStorage.getUserActivityStats(userId);
      
      res.json({
        user,
        stats,
        session: {
          id: req.sessionId,
          authenticated: true,
          provider: req.user.signInProvider,
        }
      });
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: any, res) => {
    try {
      const sessionId = req.sessionId;
      const revoked = authService.revokeSession(sessionId);
      
      res.json({ 
        success: true, 
        message: revoked ? 'Session revoked' : 'Session not found' 
      });
    } catch (error) {
      console.error("❌ Error during logout:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.post('/api/auth/logout-all', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const revokedCount = authService.revokeAllUserSessions(userId);
      
      res.json({ 
        success: true, 
        message: `${revokedCount} sessions revoked` 
      });
    } catch (error) {
      console.error("❌ Error during logout-all:", error);
      res.status(500).json({ message: "Logout all failed" });
    }
  });

  // Subscription management
  app.get('/api/subscription-plans', optionalAuth, async (req, res) => {
    try {
      const plans = stripeService.getAllPlans();
      res.json({ plans });
    } catch (error) {
      console.error("❌ Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  app.post('/api/create-subscription', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { planType, successUrl, cancelUrl } = req.body;
      
      if (!planType) {
        return res.status(400).json({ message: "Plan type is required" });
      }

      const user = await optimizedStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has an active subscription
      const activeSubscription = await optimizedStorage.getActiveSubscription(userId);
      if (activeSubscription && activeSubscription.periodEnd && new Date() < activeSubscription.periodEnd) {
        return res.status(400).json({ 
          message: "You already have an active subscription",
          currentPlan: activeSubscription.tier,
          expiresAt: activeSubscription.periodEnd
        });
      }

      const sessionData = await stripeService.createCheckoutSession(
        userId, 
        planType, 
        successUrl, 
        cancelUrl
      );

      res.json(sessionData);
    } catch (error: any) {
      console.error('❌ Payment creation error:', error);
      res.status(500).json({ 
        message: error.message || "Failed to create checkout session" 
      });
    }
  });

  app.get('/api/subscription-status', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      await optimizedStorage.checkAndUpdateExpiredSubscription(userId);
      
      const user = await optimizedStorage.getUser(userId);
      const activeSubscription = await optimizedStorage.getActiveSubscription(userId);
      const subscriptionHistory = await optimizedStorage.getUserSubscriptionHistory(userId);
      
      res.json({
        currentPlan: user?.subscriptionTier || null,
        status: user?.subscriptionStatus || 'inactive',
        activeSubscription: activeSubscription ? {
          tier: activeSubscription.tier,
          status: activeSubscription.status,
          periodStart: activeSubscription.periodStart,
          periodEnd: activeSubscription.periodEnd,
          amount: activeSubscription.amount,
        } : null,
        history: subscriptionHistory.slice(0, 5), // Latest 5
      });
    } catch (error) {
      console.error('❌ Error fetching subscription status:', error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  // PDF generation
  app.post('/api/generate-pdf', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      let user = await optimizedStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check and update expired subscription
      await optimizedStorage.checkAndUpdateExpiredSubscription(userId);
      
      // Refresh user data after potential expiration check
      const updatedUser = await optimizedStorage.getUser(userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check subscription status
      if (!updatedUser.subscriptionTier || updatedUser.subscriptionStatus !== 'active') {
        return res.status(403).json({ 
          message: "Please subscribe to a plan to generate PDFs.",
          requiresUpgrade: true 
        });
      }
      
      user = updatedUser;
      
      // Check usage limits for basic plan
      if (user.subscriptionTier === 'basic_weekly') {
        const dailyUsage = await optimizedStorage.getUserDailyUsage(userId);
        if (dailyUsage >= 3) {
          return res.status(429).json({ 
            message: "Daily limit reached. Upgrade to Pro for unlimited PDFs.",
            requiresUpgrade: true,
            dailyUsage,
            dailyLimit: 3
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
      } else {
        return res.status(400).json({ 
          message: "Unsupported platform. Supported: ChatGPT, Claude, Gemini" 
        });
      }

      // Check platform restrictions for basic users
      if (user.subscriptionTier === 'basic_weekly' && platform !== 'chatgpt') {
        return res.status(403).json({ 
          message: "Basic plan supports ChatGPT only. Upgrade to Pro for all platforms.",
          requiresUpgrade: true,
          supportedPlatforms: ['chatgpt'],
          requestedPlatform: platform
        });
      }

      // Create PDF record
      const pdfRecord = await optimizedStorage.createPdfRecord({
        userId,
        originalUrl: url,
        platform,
        fileName: `chat-export-${Date.now()}.pdf`,
        isWatermarked: user.subscriptionTier === 'basic_weekly',
        processingStatus: 'processing',
      });

      // Start PDF generation asynchronously
      Promise.race([
        generatePdf(url, pdfRecord.id, user.subscriptionTier === 'basic_weekly'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timeout after 5 minutes')), 300000)
        )
      ])
        .then(async (result: any) => {
          console.log(`🎉 PDF generation completed for record: ${pdfRecord.id}`);
          await optimizedStorage.updatePdfRecord(pdfRecord.id, {
            processingStatus: 'completed',
            fileSize: result.size,
            downloadUrl: result.downloadUrl,
            fileName: result.fileName || pdfRecord.fileName,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          
          // Increment usage for basic users
          if (user.subscriptionTier === 'basic_weekly') {
            await optimizedStorage.incrementUserUsage(userId);
          }
          
          console.log(`✅ PDF record updated successfully: ${pdfRecord.id}`);
        })
        .catch(async (error) => {
          console.error(`❌ PDF generation failed for ${pdfRecord.id}:`, error.message);
          await optimizedStorage.updatePdfRecord(pdfRecord.id, {
            processingStatus: 'failed',
          });
        });

      res.json({ 
        message: "PDF generation started",
        recordId: pdfRecord.id,
        estimatedTime: "30-60 seconds"
      });
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // PDF status and download
  app.get('/api/pdf-status/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      
      const record = await optimizedStorage.getPdfRecord(id);
      if (!record || record.userId !== userId) {
        return res.status(404).json({ message: "PDF record not found" });
      }
      
      res.json({
        id: record.id,
        status: record.processingStatus,
        fileName: record.fileName,
        platform: record.platform,
        isWatermarked: record.isWatermarked,
        fileSize: record.fileSize,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        downloadUrl: record.processingStatus === 'completed' ? `/api/download-pdf/${id}` : null,
      });
    } catch (error) {
      console.error('❌ PDF status error:', error);
      res.status(500).json({ message: "Failed to get PDF status" });
    }
  });

  app.get('/api/download-pdf/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      
      const record = await optimizedStorage.getPdfRecord(id);
      if (!record || record.userId !== userId) {
        return res.status(404).json({ message: "PDF record not found" });
      }
      
      if (record.processingStatus !== 'completed') {
        return res.status(400).json({ 
          message: "PDF not ready for download",
          status: record.processingStatus
        });
      }
      
      // Check if PDF has expired
      if (record.expiresAt && new Date() > record.expiresAt) {
        return res.status(410).json({ message: "PDF download has expired" });
      }
      
      const fs = require('fs');
      const path = require('path');
      
      const filePath = path.join(appConfig.storagePath, record.fileName || `pdf-${record.id}.pdf`);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "PDF file not found on server" });
      }
      
      // Set proper headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
      res.setHeader('Cache-Control', 'private, no-cache');
      
      // Stream the PDF file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error: any) => {
        console.error('❌ File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error streaming PDF file" });
        }
      });
      
    } catch (error) {
      console.error('❌ PDF download error:', error);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  // User dashboard
  app.get('/api/user-pdfs', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const limit = parseInt(req.query.limit as string) || 10;
      const records = await optimizedStorage.getUserPdfRecords(userId, limit);
      res.json({ records });
    } catch (error) {
      console.error('❌ User PDFs error:', error);
      res.status(500).json({ message: "Failed to get PDF records" });
    }
  });

  app.get('/api/user-stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      await optimizedStorage.checkAndUpdateExpiredSubscription(userId);
      
      const user = await optimizedStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const dailyUsage = await optimizedStorage.getUserDailyUsage(userId);
      const totalPdfs = await optimizedStorage.getUserPdfRecords(userId, 1000);
      const activityStats = await optimizedStorage.getUserActivityStats(userId);
      
      const plan = stripeService.getPlan(user.subscriptionTier || '');
      
      res.json({
        dailyUsage,
        dailyLimit: plan?.limits.dailyPdfs || 0,
        totalPdfs: totalPdfs.length,
        subscriptionTier: user.subscriptionTier || null,
        subscriptionStatus: user.subscriptionStatus,
        supportedPlatforms: plan?.limits.platforms || [],
        hasWatermark: plan?.limits.watermark ?? true,
        activityStats,
      });
    } catch (error) {
      console.error('❌ User stats error:', error);
      res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  // Admin endpoints
  app.post('/api/admin/expire-subscriptions', requireAdmin, async (req, res) => {
    try {
      const result = await optimizedStorage.expireAllExpiredSubscriptionsAtomic();
      res.json({ 
        message: `Expired ${result.expiredCount} subscriptions`, 
        expiredCount: result.expiredCount,
        expiredUsers: result.expiredUsers
      });
    } catch (error) {
      console.error('❌ Bulk expiration error:', error);
      res.status(500).json({ message: "Failed to expire subscriptions" });
    }
  });

  app.get('/api/admin/system-stats', requireAdmin, async (req, res) => {
    try {
      const cacheStats = optimizedStorage.getCacheStats();
      const sessionStats = authService.getSessionStats();
      const webhookStats = webhookHandler.getEventStats();
      const subscriptionStats = await optimizedStorage.getSubscriptionStats();
      
      res.json({
        cache: cacheStats,
        sessions: sessionStats,
        webhooks: webhookStats,
        subscriptions: subscriptionStats,
        system: {
          nodeEnv: appConfig.nodeEnv,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        }
      });
    } catch (error) {
      console.error('❌ System stats error:', error);
      res.status(500).json({ message: "Failed to get system stats" });
    }
  });

  app.get('/api/admin/webhook-logs', requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = webhookHandler.getEventLog(limit);
      res.json({ logs });
    } catch (error) {
      console.error('❌ Webhook logs error:', error);
      res.status(500).json({ message: "Failed to get webhook logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}