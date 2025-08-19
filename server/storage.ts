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
import { db } from "./db";
import { eq, and, gte, desc, lte } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;
  
  // Subscription operations
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserSubscription(userId: string, tier: string, status: string): Promise<User>;
  
  // Usage tracking
  getUserDailyUsage(userId: string): Promise<number>;
  incrementUserUsage(userId: string): Promise<void>;
  resetDailyUsageIfNeeded(userId: string): Promise<void>;
  
  // PDF operations
  createPdfRecord(record: InsertPdfRecord): Promise<PdfRecord>;
  updatePdfRecord(id: string, updates: Partial<PdfRecord>): Promise<PdfRecord>;
  getUserPdfRecords(userId: string, limit?: number): Promise<PdfRecord[]>;
  getPdfRecord(id: string): Promise<PdfRecord | undefined>;
  
  // Subscription history
  addSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory>;
  getUserSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]>;
  
  // Subscription expiration
  checkAndUpdateExpiredSubscription(userId: string): Promise<User | undefined>;
  getActiveSubscription(userId: string): Promise<SubscriptionHistory | undefined>;
  expireAllExpiredSubscriptions(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Simple upsert by Firebase UID - each Firebase UID gets its own user record
    // Even if the same email is used with different Google accounts
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

  async updateUserProfile(id: string, updates: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserSubscription(userId: string, tier: string, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserDailyUsage(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    await this.resetDailyUsageIfNeeded(userId);
    
    const updatedUser = await this.getUser(userId);
    return updatedUser?.dailyUsage || 0;
  }

  async incrementUserUsage(userId: string): Promise<void> {
    await this.resetDailyUsageIfNeeded(userId);
    
    // Get current usage first
    const currentUser = await this.getUser(userId);
    if (!currentUser) return;
    
    await db
      .update(users)
      .set({
        dailyUsage: (currentUser.dailyUsage || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async resetDailyUsageIfNeeded(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const now = new Date();
    const lastReset = user.lastUsageReset;
    
    if (!lastReset || now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await db
        .update(users)
        .set({
          dailyUsage: 0,
          lastUsageReset: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    }
  }

  async createPdfRecord(record: InsertPdfRecord): Promise<PdfRecord> {
    const id = nanoid();
    const [pdfRecord] = await db
      .insert(pdfRecords)
      .values({ ...record, id })
      .returning();
    return pdfRecord;
  }

  async updatePdfRecord(id: string, updates: Partial<PdfRecord>): Promise<PdfRecord> {
    const [pdfRecord] = await db
      .update(pdfRecords)
      .set(updates)
      .where(eq(pdfRecords.id, id))
      .returning();
    return pdfRecord;
  }

  async getUserPdfRecords(userId: string, limit: number = 10): Promise<PdfRecord[]> {
    return await db
      .select()
      .from(pdfRecords)
      .where(eq(pdfRecords.userId, userId))
      .orderBy(desc(pdfRecords.createdAt))
      .limit(limit);
  }

  async getPdfRecord(id: string): Promise<PdfRecord | undefined> {
    const [record] = await db.select().from(pdfRecords).where(eq(pdfRecords.id, id));
    return record;
  }

  async addSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory> {
    const id = nanoid();
    const [record] = await db
      .insert(subscriptionHistory)
      .values({ ...history, id })
      .returning();
    return record;
  }

  async getUserSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]> {
    return await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, userId))
      .orderBy(desc(subscriptionHistory.createdAt));
  }

  async getActiveSubscription(userId: string): Promise<SubscriptionHistory | undefined> {
    const [activeSubscription] = await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(
          eq(subscriptionHistory.userId, userId),
          eq(subscriptionHistory.status, 'active')
        )
      )
      .orderBy(desc(subscriptionHistory.createdAt))
      .limit(1);
    
    return activeSubscription;
  }

  async checkAndUpdateExpiredSubscription(userId: string): Promise<User | undefined> {
    const activeSubscription = await this.getActiveSubscription(userId);
    
    if (!activeSubscription || !activeSubscription.periodEnd) {
      // No active subscription or no end date
      return await this.updateUserSubscription(userId, '', 'inactive');
    }

    const now = new Date();
    if (now > activeSubscription.periodEnd) {
      // Subscription has expired
      console.log(`⏰ Subscription expired for user ${userId}: ${activeSubscription.tier}`);
      
      // Update subscription history to mark as expired
      await db
        .update(subscriptionHistory)
        .set({ status: 'expired' })
        .where(eq(subscriptionHistory.id, activeSubscription.id));
      
      // Update user subscription status
      return await this.updateUserSubscription(userId, '', 'expired');
    }
    
    // Subscription is still active
    return undefined;
  }

  async expireAllExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    
    // Find all active subscriptions that have passed their end date
    const expiredSubscriptions = await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(
          eq(subscriptionHistory.status, 'active'),
          lte(subscriptionHistory.periodEnd, now)
        )
      );
    
    let expiredCount = 0;
    
    for (const sub of expiredSubscriptions) {
      try {
        await this.checkAndUpdateExpiredSubscription(sub.userId);
        expiredCount++;
      } catch (error) {
        console.error(`Failed to expire subscription for user ${sub.userId}:`, error);
      }
    }
    
    if (expiredCount > 0) {
      console.log(`⏰ Expired ${expiredCount} subscriptions`);
    }
    
    return expiredCount;
  }
}

export const storage = new DatabaseStorage();
