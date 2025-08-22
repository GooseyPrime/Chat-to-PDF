import {
  COLLECTIONS,
  type User,
  type UpsertUser,
  type InsertPdfRecord,
  type PdfRecord,
  type InsertSubscriptionHistory,
  type SubscriptionHistory,
} from "@shared/schema";
import { db } from "./db";
import { nanoid } from "nanoid";
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface IStorage {
  // User operations (mandatory for Firebase Auth)
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

export class FirestoreStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(id).get();
      if (!userDoc.exists) {
        return undefined;
      }
      const data = userDoc.data();
      return this.convertTimestampsToDate({ id, ...data }) as User;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const snapshot = await db.collection(COLLECTIONS.USERS)
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return this.convertTimestampsToDate({ id: doc.id, ...data }) as User;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const now = new Date();
      const userRef = db.collection(COLLECTIONS.USERS).doc(userData.id);
      
      // Get existing user data first
      const existingDoc = await userRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};
      
      const mergedData = {
        ...existingData,
        ...userData,
        updatedAt: now,
        // Only set createdAt if it doesn't exist
        createdAt: existingData?.createdAt || now,
        // Preserve existing subscription and usage data
        subscriptionStatus: existingData?.subscriptionStatus || 'inactive',
        dailyUsage: existingData?.dailyUsage || 0,
        lastUsageReset: existingData?.lastUsageReset || now,
      };
      
      await userRef.set(mergedData, { merge: true });
      
      return this.convertTimestampsToDate(mergedData) as User;
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async updateUserProfile(id: string, updates: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    try {
      const userRef = db.collection(COLLECTIONS.USERS).doc(id);
      await userRef.update({
        ...updates,
        updatedAt: new Date(),
      });
      
      const updated = await this.getUser(id);
      if (!updated) {
        throw new Error('User not found after update');
      }
      return updated;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    try {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      await userRef.update({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      });
      
      const updated = await this.getUser(userId);
      if (!updated) {
        throw new Error('User not found after Stripe info update');
      }
      return updated;
    } catch (error) {
      console.error('Error updating user Stripe info:', error);
      throw error;
    }
  }

  async updateUserSubscription(userId: string, tier: string, status: string): Promise<User> {
    try {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      await userRef.update({
        subscriptionTier: tier,
        subscriptionStatus: status,
        updatedAt: new Date(),
      });
      
      const updated = await this.getUser(userId);
      if (!updated) {
        throw new Error('User not found after subscription update');
      }
      return updated;
    } catch (error) {
      console.error('Error updating user subscription:', error);
      throw error;
    }
  }

  async getUserDailyUsage(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    await this.resetDailyUsageIfNeeded(userId);
    
    const updatedUser = await this.getUser(userId);
    return updatedUser?.dailyUsage || 0;
  }

  async incrementUserUsage(userId: string): Promise<void> {
    try {
      await this.resetDailyUsageIfNeeded(userId);
      
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      await userRef.update({
        dailyUsage: FieldValue.increment(1),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error incrementing user usage:', error);
      throw error;
    }
  }

  async resetDailyUsageIfNeeded(userId: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) return;

      const now = new Date();
      const lastReset = user.lastUsageReset;
      
      // Check if we need to reset (different day)
      const needsReset = !lastReset || 
        (lastReset instanceof Date && (
          now.getDate() !== lastReset.getDate() || 
          now.getMonth() !== lastReset.getMonth() || 
          now.getFullYear() !== lastReset.getFullYear()
        ));
      
      if (needsReset) {
        const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
        await userRef.update({
          dailyUsage: 0,
          lastUsageReset: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Error resetting daily usage:', error);
      throw error;
    }
  }

  async createPdfRecord(record: InsertPdfRecord): Promise<PdfRecord> {
    try {
      const id = nanoid();
      const now = new Date();
      const docData = {
        ...record,
        id,
        createdAt: now,
        isWatermarked: record.isWatermarked ?? true,
        processingStatus: record.processingStatus || 'pending',
      };
      
      await db.collection(COLLECTIONS.PDF_RECORDS).doc(id).set(docData);
      return this.convertTimestampsToDate(docData) as PdfRecord;
    } catch (error) {
      console.error('Error creating PDF record:', error);
      throw error;
    }
  }

  async updatePdfRecord(id: string, updates: Partial<PdfRecord>): Promise<PdfRecord> {
    try {
      const pdfRef = db.collection(COLLECTIONS.PDF_RECORDS).doc(id);
      await pdfRef.update(updates);
      
      const updated = await this.getPdfRecord(id);
      if (!updated) {
        throw new Error('PDF record not found after update');
      }
      return updated;
    } catch (error) {
      console.error('Error updating PDF record:', error);
      throw error;
    }
  }

  async getUserPdfRecords(userId: string, limit: number = 10): Promise<PdfRecord[]> {
    try {
      const snapshot = await db.collection(COLLECTIONS.PDF_RECORDS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return this.convertTimestampsToDate({ id: doc.id, ...data }) as PdfRecord;
      });
    } catch (error) {
      console.error('Error getting user PDF records:', error);
      throw error;
    }
  }

  async getPdfRecord(id: string): Promise<PdfRecord | undefined> {
    try {
      const doc = await db.collection(COLLECTIONS.PDF_RECORDS).doc(id).get();
      if (!doc.exists) {
        return undefined;
      }
      const data = doc.data();
      return this.convertTimestampsToDate({ id, ...data }) as PdfRecord;
    } catch (error) {
      console.error('Error getting PDF record:', error);
      throw error;
    }
  }

  async addSubscriptionHistory(history: InsertSubscriptionHistory): Promise<SubscriptionHistory> {
    try {
      const id = nanoid();
      const now = new Date();
      const docData = {
        ...history,
        id,
        createdAt: now,
        currency: history.currency || 'usd',
      };
      
      await db.collection(COLLECTIONS.SUBSCRIPTION_HISTORY).doc(id).set(docData);
      return this.convertTimestampsToDate(docData) as SubscriptionHistory;
    } catch (error) {
      console.error('Error adding subscription history:', error);
      throw error;
    }
  }

  async getUserSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]> {
    try {
      const snapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_HISTORY)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return this.convertTimestampsToDate({ id: doc.id, ...data }) as SubscriptionHistory;
      });
    } catch (error) {
      console.error('Error getting user subscription history:', error);
      throw error;
    }
  }

  async getActiveSubscription(userId: string): Promise<SubscriptionHistory | undefined> {
    try {
      const snapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_HISTORY)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return this.convertTimestampsToDate({ id: doc.id, ...data }) as SubscriptionHistory;
    } catch (error) {
      console.error('Error getting active subscription:', error);
      throw error;
    }
  }

  async checkAndUpdateExpiredSubscription(userId: string): Promise<User | undefined> {
    try {
      const activeSubscription = await this.getActiveSubscription(userId);
      
      if (!activeSubscription || !activeSubscription.periodEnd) {
        // No active subscription or no end date
        return await this.updateUserSubscription(userId, '', 'inactive');
      }

      const now = new Date();
      let periodEnd: Date;
      
      if (activeSubscription.periodEnd instanceof Date) {
        periodEnd = activeSubscription.periodEnd;
      } else if (activeSubscription.periodEnd && typeof activeSubscription.periodEnd === 'object' && 'toDate' in activeSubscription.periodEnd) {
        // Handle Firestore Timestamp
        periodEnd = (activeSubscription.periodEnd as any).toDate();
      } else {
        // Fallback for other date formats
        periodEnd = new Date(activeSubscription.periodEnd!);
      }
        
      if (now > periodEnd) {
        // Subscription has expired
        console.log(`⏰ Subscription expired for user ${userId}: ${activeSubscription.tier}`);
        
        // Update subscription history to mark as expired
        await db.collection(COLLECTIONS.SUBSCRIPTION_HISTORY)
          .doc(activeSubscription.id)
          .update({ status: 'expired' });
        
        // Update user subscription status
        return await this.updateUserSubscription(userId, '', 'expired');
      }
      
      // Subscription is still active
      return undefined;
    } catch (error) {
      console.error('Error checking and updating expired subscription:', error);
      throw error;
    }
  }

  async expireAllExpiredSubscriptions(): Promise<number> {
    try {
      const now = new Date();
      let expiredCount = 0;
      
      // Find all active subscriptions that have passed their end date
      const snapshot = await db.collection(COLLECTIONS.SUBSCRIPTION_HISTORY)
        .where('status', '==', 'active')
        .where('periodEnd', '<=', now)
        .get();
      
      // Process each expired subscription
      for (const doc of snapshot.docs) {
        try {
          const data = doc.data();
          await this.checkAndUpdateExpiredSubscription(data.userId);
          expiredCount++;
        } catch (error) {
          console.error(`Failed to expire subscription for user ${doc.data().userId}:`, error);
        }
      }
      
      if (expiredCount > 0) {
        console.log(`⏰ Expired ${expiredCount} subscriptions`);
      }
      
      return expiredCount;
    } catch (error) {
      console.error('Error expiring all expired subscriptions:', error);
      throw error;
    }
  }

  // Helper method to convert Firestore Timestamps to Date objects
  private convertTimestampsToDate(data: any): any {
    if (!data) return data;
    
    const converted = { ...data };
    
    // Convert known timestamp fields
    const timestampFields = ['createdAt', 'updatedAt', 'lastUsageReset', 'expiresAt', 'periodStart', 'periodEnd'];
    
    for (const field of timestampFields) {
      if (converted[field] && typeof converted[field] === 'object' && converted[field].toDate) {
        converted[field] = converted[field].toDate();
      }
    }
    
    return converted;
  }
}

export const storage = new FirestoreStorage();
