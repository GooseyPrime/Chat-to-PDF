// server/storage/transactionStorage.ts
import {
  users,
  pdfRecords,
  subscriptionHistory,
  type User,
  type UpsertUser,
  type InsertPdfRecord,
  type PdfRecord,
  type InsertSubscriptionHistory,
  type SubscriptionHistory,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, gte, desc, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";

type Transaction = PgTransaction<any, any, any>;

export interface ITransactionStorage {
  // Transaction wrapper
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  
  // Transaction-aware operations
  updateUserSubscriptionTx(tx: Transaction, userId: string, tier: string, status: string): Promise<User>;
  addSubscriptionHistoryTx(tx: Transaction, history: InsertSubscriptionHistory): Promise<SubscriptionHistory>;
  createPdfRecordTx(tx: Transaction, record: InsertPdfRecord): Promise<PdfRecord>;
  incrementUserUsageTx(tx: Transaction, userId: string): Promise<void>;
  
  // Atomic operations
  activateSubscriptionAtomic(userId: string, planType: string, sessionId: string, amount: string, periodStart: Date, periodEnd: Date): Promise<{ user: User; history: SubscriptionHistory }>;
  expireSubscriptionAtomic(userId: string, reason: string): Promise<User>;
  processPaymentFailureAtomic(userId: string, paymentIntentId: string): Promise<void>;
  
  // Optimized bulk operations
  expireAllExpiredSubscriptionsAtomic(): Promise<{ expiredCount: number; expiredUsers: string[] }>;
  resetAllDailyUsageAtomic(): Promise<number>;
  cleanupExpiredPdfRecords(daysSinceExpiry: number): Promise<number>;
}

export class TransactionStorage implements ITransactionStorage {
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return await db.transaction(fn);
  }

  async updateUserSubscriptionTx(
    tx: Transaction, 
    userId: string, 
    tier: string, 
    status: string
  ): Promise<User> {
    const [user] = await tx
      .update(users)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return user;
  }

  async addSubscriptionHistoryTx(
    tx: Transaction, 
    history: InsertSubscriptionHistory
  ): Promise<SubscriptionHistory> {
    const id = nanoid();
    const [record] = await tx
      .insert(subscriptionHistory)
      .values({ ...history, id })
      .returning();
    
    return record;
  }

  async createPdfRecordTx(
    tx: Transaction, 
    record: InsertPdfRecord
  ): Promise<PdfRecord> {
    const id = nanoid();
    const [pdfRecord] = await tx
      .insert(pdfRecords)
      .values({ ...record, id })
      .returning();
    
    return pdfRecord;
  }

  async incrementUserUsageTx(tx: Transaction, userId: string): Promise<void> {
    // First reset daily usage if needed (atomic check and reset)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    await tx
      .update(users)
      .set({
        dailyUsage: sql`CASE 
          WHEN DATE(${users.lastUsageReset}) < ${today.toISOString()::date} 
          THEN 1 
          ELSE ${users.dailyUsage} + 1 
        END`,
        lastUsageReset: sql`CASE 
          WHEN DATE(${users.lastUsageReset}) < ${today.toISOString()::date} 
          THEN ${now} 
          ELSE ${users.lastUsageReset} 
        END`,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  }

  async activateSubscriptionAtomic(
    userId: string, 
    planType: string, 
    sessionId: string, 
    amount: string, 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<{ user: User; history: SubscriptionHistory }> {
    return await this.transaction(async (tx) => {
      // 1. Update user subscription
      const user = await this.updateUserSubscriptionTx(tx, userId, planType, 'active');
      
      // 2. Add subscription history
      const history = await this.addSubscriptionHistoryTx(tx, {
        userId,
        stripeSubscriptionId: sessionId,
        tier: planType,
        status: 'active',
        amount,
        currency: 'usd',
        periodStart,
        periodEnd,
      });
      
      // 3. Expire any previous active subscriptions
      await tx
        .update(subscriptionHistory)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(subscriptionHistory.userId, userId),
            eq(subscriptionHistory.status, 'active'),
            sql`${subscriptionHistory.id} != ${history.id}`
          )
        );
      
      return { user, history };
    });
  }

  async expireSubscriptionAtomic(userId: string, reason: string): Promise<User> {
    return await this.transaction(async (tx) => {
      // 1. Update user subscription status
      const user = await this.updateUserSubscriptionTx(tx, userId, '', 'expired');
      
      // 2. Mark active subscription history as expired
      await tx
        .update(subscriptionHistory)
        .set({ 
          status: 'expired',
          // Add expiry reason to metadata if you have a jsonb column
        })
        .where(
          and(
            eq(subscriptionHistory.userId, userId),
            eq(subscriptionHistory.status, 'active')
          )
        );
      
      return user;
    });
  }

  async processPaymentFailureAtomic(userId: string, paymentIntentId: string): Promise<void> {
    await this.transaction(async (tx) => {
      // 1. Update user subscription to failed
      await this.updateUserSubscriptionTx(tx, userId, '', 'payment_failed');
      
      // 2. Add failure record to history
      await this.addSubscriptionHistoryTx(tx, {
        userId,
        stripeSubscriptionId: paymentIntentId,
        tier: '',
        status: 'payment_failed',
        amount: '0',
        currency: 'usd',
        periodStart: new Date(),
        periodEnd: new Date(),
      });
    });
  }

  async expireAllExpiredSubscriptionsAtomic(): Promise<{ expiredCount: number; expiredUsers: string[] }> {
    return await this.transaction(async (tx) => {
      const now = new Date();
      
      // Find all active subscriptions that have expired
      const expiredSubscriptions = await tx
        .select({
          id: subscriptionHistory.id,
          userId: subscriptionHistory.userId,
          tier: subscriptionHistory.tier,
          periodEnd: subscriptionHistory.periodEnd,
        })
        .from(subscriptionHistory)
        .where(
          and(
            eq(subscriptionHistory.status, 'active'),
            lte(subscriptionHistory.periodEnd, now)
          )
        );
      
      if (expiredSubscriptions.length === 0) {
        return { expiredCount: 0, expiredUsers: [] };
      }
      
      const expiredUserIds = expiredSubscriptions.map(sub => sub.userId);
      const expiredSubIds = expiredSubscriptions.map(sub => sub.id);
      
      // Update subscription history to expired
      await tx
        .update(subscriptionHistory)
        .set({ status: 'expired' })
        .where(sql`${subscriptionHistory.id} = ANY(${expiredSubIds})`);
      
      // Update users to inactive status
      await tx
        .update(users)
        .set({
          subscriptionTier: '',
          subscriptionStatus: 'expired',
          updatedAt: now,
        })
        .where(sql`${users.id} = ANY(${expiredUserIds})`);
      
      console.log(`⏰ Bulk expired ${expiredSubscriptions.length} subscriptions:`, expiredUserIds);
      
      return {
        expiredCount: expiredSubscriptions.length,
        expiredUsers: expiredUserIds,
      };
    });
  }

  async resetAllDailyUsageAtomic(): Promise<number> {
    const now = new Date();
    
    const result = await db
      .update(users)
      .set({
        dailyUsage: 0,
        lastUsageReset: now,
        updatedAt: now,
      })
      .where(
        sql`DATE(${users.lastUsageReset}) < DATE(${now})`
      );
    
    const affectedRows = result.rowCount || 0;
    console.log(`🔄 Reset daily usage for ${affectedRows} users`);
    
    return affectedRows;
  }

  async cleanupExpiredPdfRecords(daysSinceExpiry: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceExpiry);
    
    const result = await db
      .delete(pdfRecords)
      .where(
        and(
          eq(pdfRecords.processingStatus, 'completed'),
          lte(pdfRecords.expiresAt, cutoffDate)
        )
      );
    
    const deletedCount = result.rowCount || 0;
    console.log(`🗑️ Cleaned up ${deletedCount} expired PDF records older than ${daysSinceExpiry} days`);
    
    return deletedCount;
  }

  // Performance monitoring queries
  async getSubscriptionStats(): Promise<{
    activeSubscriptions: number;
    expiredSubscriptions: number;
    pendingPayments: number;
    totalRevenue: number;
  }> {
    const [stats] = await db
      .select({
        activeSubscriptions: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        expiredSubscriptions: sql<number>`COUNT(*) FILTER (WHERE status = 'expired')`,
        pendingPayments: sql<number>`COUNT(*) FILTER (WHERE status = 'payment_failed')`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN status = 'active' THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(subscriptionHistory);
    
    return stats;
  }

  async getUserActivityStats(userId: string): Promise<{
    totalPdfs: number;
    todayPdfs: number;
    subscriptionHistory: number;
    currentTier: string | null;
    daysUntilExpiry: number | null;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [stats] = await db
      .select({
        totalPdfs: sql<number>`(SELECT COUNT(*) FROM ${pdfRecords} WHERE user_id = ${userId})`,
        todayPdfs: sql<number>`(SELECT COUNT(*) FROM ${pdfRecords} WHERE user_id = ${userId} AND DATE(created_at) = DATE(${now}))`,
        subscriptionHistory: sql<number>`(SELECT COUNT(*) FROM ${subscriptionHistory} WHERE user_id = ${userId})`,
        currentTier: sql<string>`(SELECT subscription_tier FROM ${users} WHERE id = ${userId})`,
        daysUntilExpiry: sql<number>`(
          SELECT GREATEST(0, EXTRACT(DAY FROM period_end - ${now}))
          FROM ${subscriptionHistory} 
          WHERE user_id = ${userId} AND status = 'active' 
          ORDER BY created_at DESC LIMIT 1
        )`,
      })
      .from(sql`(SELECT 1) as dummy`);
    
    return stats;
  }
}

// Enhanced storage interface that includes transaction methods
export interface IEnhancedStorage extends ITransactionStorage {
  // Original storage methods remain available
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // ... other existing methods
}

export class EnhancedDatabaseStorage extends TransactionStorage implements IEnhancedStorage {
  // Include all original storage methods by delegating to the existing storage
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
  
  // Add all other existing methods here...
  // (I'll keep this concise to stay within response limits)
}

export const transactionStorage = new EnhancedDatabaseStorage();