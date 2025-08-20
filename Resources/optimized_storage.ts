// server/storage/optimizedStorage.ts
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
import { TransactionStorage } from "./transactionStorage";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = { hits: 0, misses: 0 };
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 10000, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    return entry.data;
  }

  set(key: string, data: T, ttl: number = this.defaultTTL): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${toDelete.length} expired entries`);
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
}

export class OptimizedStorage extends TransactionStorage {
  private userCache = new Cache<User>(5000, 5 * 60 * 1000); // 5 minutes
  private subscriptionCache = new Cache<SubscriptionHistory>(2000, 2 * 60 * 1000); // 2 minutes
  private usageCache = new Cache<number>(5000, 30 * 1000); // 30 seconds
  private pdfCache = new Cache<PdfRecord[]>(1000, 60 * 1000); // 1 minute

  // Optimized user operations
  async getUser(id: string): Promise<User | undefined> {
    const cacheKey = `user:${id}`;
    let user = this.userCache.get(cacheKey);
    
    if (!user) {
      const [dbUser] = await db.select().from(users).where(eq(users.id, id));
      if (dbUser) {
        this.userCache.set(cacheKey, dbUser);
        user = dbUser;
      }
    }
    
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const cacheKey = `user:email:${email}`;
    let user = this.userCache.get(cacheKey);
    
    if (!user) {
      const [dbUser] = await db.select().from(users).where(eq(users.email, email));
      if (dbUser) {
        this.userCache.set(cacheKey, dbUser);
        this.userCache.set(`user:${dbUser.id}`, dbUser); // Cache by ID too
        user = dbUser;
      }
    }
    
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

    // Update cache
    this.userCache.set(`user:${user.id}`, user);
    if (user.email) {
      this.userCache.set(`user:email:${user.email}`, user);
    }

    return user;
  }

  async updateUserProfile(
    id: string, 
    updates: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Update cache
    this.userCache.set(`user:${user.id}`, user);
    if (user.email) {
      this.userCache.set(`user:email:${user.email}`, user);
    }

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

    // Invalidate related caches
    this.userCache.delete(`user:${userId}`);
    this.subscriptionCache.delete(`active:${userId}`);
    this.usageCache.delete(`usage:${userId}`);

    // Cache updated user
    this.userCache.set(`user:${user.id}`, user);
    if (user.email) {
      this.userCache.set(`user:email:${user.email}`, user);
    }

    return user;
  }

  // Optimized usage tracking
  async getUserDailyUsage(userId: string): Promise<number> {
    const cacheKey = `usage:${userId}`;
    let usage = this.usageCache.get(cacheKey);
    
    if (usage === undefined) {
      const user = await this.getUser(userId);
      if (!user) return 0;

      await this.resetDailyUsageIfNeeded(userId);
      
      const updatedUser = await this.getUser(userId);
      usage = updatedUser?.dailyUsage || 0;
      
      this.usageCache.set(cacheKey, usage, 30 * 1000); // Cache for 30 seconds
    }
    
    return usage;
  }

  async incrementUserUsage(userId: string): Promise<void> {
    await this.resetDailyUsageIfNeeded(userId);
    
    const currentUser = await this.getUser(userId);
    if (!currentUser) return;
    
    await db
      .update(users)
      .set({
        dailyUsage: (currentUser.dailyUsage || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate cache
    this.userCache.delete(`user:${userId}`);
    this.usageCache.delete(`usage:${userId}`);
  }

  private async resetDailyUsageIfNeeded(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const now = new Date();
    const lastReset = user.lastUsageReset;
    
    if (!lastReset || now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      
      await db
        .update(users)
        .set({
          dailyUsage: 0,
          lastUsageReset: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      // Invalidate cache
      this.userCache.delete(`user:${userId}`);
      this.usageCache.delete(`usage:${userId}`);
    }
  }

  // Optimized PDF operations
  async createPdfRecord(record: InsertPdfRecord): Promise<PdfRecord> {
    const id = nanoid();
    const [pdfRecord] = await db
      .insert(pdfRecords)
      .values({ ...record, id })
      .returning();

    // Invalidate user's PDF cache
    this.pdfCache.delete(`pdfs:${record.userId}`);

    return pdfRecord;
  }

  async updatePdfRecord(id: string, updates: Partial<PdfRecord>): Promise<PdfRecord> {
    const [pdfRecord] = await db
      .update(pdfRecords)
      .set(updates)
      .where(eq(pdfRecords.id, id))
      .returning();

    // Invalidate user's PDF cache
    if (pdfRecord.userId) {
      this.pdfCache.delete(`pdfs:${pdfRecord.userId}`);
    }

    return pdfRecord;
  }

  async getUserPdfRecords(userId: string, limit: number = 10): Promise<PdfRecord[]> {
    const cacheKey = `pdfs:${userId}:${limit}`;
    let records = this.pdfCache.get(cacheKey);
    
    if (!records) {
      records = await db
        .select()
        .from(pdfRecords)
        .where(eq(pdfRecords.userId, userId))
        .orderBy(desc(pdfRecords.createdAt))
        .limit(limit);
      
      this.pdfCache.set(cacheKey, records);
    }
    
    return records;
  }

  async getPdfRecord(id: string): Promise<PdfRecord | undefined> {
    const [record] = await db.select().from(pdfRecords).where(eq(pdfRecords.id, id));
    return record;
  }

  // Optimized subscription operations
  async addSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory> {
    const id = nanoid();
    const [record] = await db
      .insert(subscriptionHistory)
      .values({ ...history, id })
      .returning();

    // Invalidate cache
    this.subscriptionCache.delete(`active:${history.userId}`);

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
    const cacheKey = `active:${userId}`;
    let activeSubscription = this.subscriptionCache.get(cacheKey);
    
    if (!activeSubscription) {
      const [subscription] = await db
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
      
      if (subscription) {
        this.subscriptionCache.set(cacheKey, subscription);
        activeSubscription = subscription;
      }
    }
    
    return activeSubscription;
  }

  async checkAndUpdateExpiredSubscription(userId: string): Promise<User | undefined> {
    const activeSubscription = await this.getActiveSubscription(userId);
    
    if (!activeSubscription || !activeSubscription.periodEnd) {
      return await this.updateUserSubscription(userId, '', 'inactive');
    }

    const now = new Date();
    if (now > activeSubscription.periodEnd) {
      console.log(`⏰ Subscription expired for user ${userId}: ${activeSubscription.tier}`);
      
      await db
        .update(subscriptionHistory)
        .set({ status: 'expired' })
        .where(eq(subscriptionHistory.id, activeSubscription.id));
      
      return await this.updateUserSubscription(userId, '', 'expired');
    }
    
    return undefined;
  }

  // Batch operations for performance
  async batchGetUsers(userIds: string[]): Promise<Map<string, User>> {
    const userMap = new Map<string, User>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const userId of userIds) {
      const cached = this.userCache.get(`user:${userId}`);
      if (cached) {
        userMap.set(userId, cached);
      } else {
        uncachedIds.push(userId);
      }
    }

    // Fetch uncached users in batch
    if (uncachedIds.length > 0) {
      const dbUsers = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ANY(${uncachedIds})`);

      for (const user of dbUsers) {
        userMap.set(user.id, user);
        this.userCache.set(`user:${user.id}`, user);
      }
    }

    return userMap;
  }

  // Cache management
  getCacheStats(): {
    users: CacheStats;
    subscriptions: CacheStats;
    usage: CacheStats;
    pdfs: CacheStats;
  } {
    return {
      users: this.userCache.getStats(),
      subscriptions: this.subscriptionCache.getStats(),
      usage: this.usageCache.getStats(),
      pdfs: this.pdfCache.getStats(),
    };
  }

  clearAllCaches(): void {
    this.userCache.clear();
    this.subscriptionCache.clear();
    this.usageCache.clear();
    this.pdfCache.clear();
    console.log('🧹 All caches cleared');
  }

  warmupCache(userIds: string[]): Promise<void> {
    console.log(`🔥 Warming up cache for ${userIds.length} users`);
    return this.batchGetUsers(userIds).then(() => {
      console.log('✅ Cache warmup completed');
    });
  }
}

export const optimizedStorage = new OptimizedStorage();