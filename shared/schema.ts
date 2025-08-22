import { z } from "zod";
import { Timestamp } from "firebase/firestore";

// Firebase Firestore doesn't require table schemas like SQL databases,
// but we define TypeScript types and Zod schemas for data validation

// User document type (stored in 'users' collection)
export interface User {
  id: string; // Firebase UID as document ID
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string; // active, inactive, canceled, past_due, expired
  subscriptionTier?: string | null; // basic_weekly, pro_weekly, pro_annual, team
  dailyUsage?: number;
  lastUsageReset?: Date | Timestamp | null;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

// PDF Record document type (stored in 'pdfRecords' collection)
export interface PdfRecord {
  id: string;
  userId: string;
  originalUrl: string;
  platform: string; // chatgpt, claude, gemini
  fileName: string;
  fileSize?: number | null; // in bytes
  isWatermarked?: boolean;
  processingStatus?: string; // pending, processing, completed, failed
  downloadUrl?: string | null;
  createdAt?: Date | Timestamp;
  expiresAt?: Date | Timestamp | null; // for temporary download links
}

// Subscription History document type (stored in 'subscriptionHistory' collection)
export interface SubscriptionHistory {
  id: string;
  userId: string;
  stripeSubscriptionId?: string | null;
  tier: string;
  status: string;
  amount?: string | null; // stored as string to avoid precision issues
  currency?: string;
  periodStart?: Date | Timestamp | null;
  periodEnd?: Date | Timestamp | null;
  createdAt?: Date | Timestamp;
}

// Zod validation schemas
export const upsertUserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  profileImageUrl: z.string().url().optional().nullable(),
});

export const insertPdfRecordSchema = z.object({
  userId: z.string(),
  originalUrl: z.string().url(),
  platform: z.string(),
  fileName: z.string(),
  fileSize: z.number().optional().nullable(),
  isWatermarked: z.boolean().optional(),
  processingStatus: z.string().optional(),
  downloadUrl: z.string().url().optional().nullable(),
  expiresAt: z.date().optional().nullable(),
});

export const insertSubscriptionHistorySchema = z.object({
  userId: z.string(),
  stripeSubscriptionId: z.string().optional().nullable(),
  tier: z.string(),
  status: z.string(),
  amount: z.string().optional().nullable(),
  currency: z.string().optional(),
  periodStart: z.date().optional().nullable(),
  periodEnd: z.date().optional().nullable(),
});

// Inferred types for easier usage
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertPdfRecord = z.infer<typeof insertPdfRecordSchema>;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;

// Collection names - centralized for consistency
export const COLLECTIONS = {
  USERS: 'users',
  PDF_RECORDS: 'pdfRecords', 
  SUBSCRIPTION_HISTORY: 'subscriptionHistory',
} as const;
