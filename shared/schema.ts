import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("inactive"), // active, inactive, canceled, past_due
  subscriptionTier: varchar("subscription_tier"), // basic_weekly, pro_monthly, pro_annual, team
  dailyUsage: integer("daily_usage").default(0),
  lastUsageReset: timestamp("last_usage_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PDF generation records
export const pdfRecords = pgTable("pdf_records", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalUrl: text("original_url").notNull(),
  platform: varchar("platform").notNull(), // chatgpt, claude, gemini
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // in bytes
  isWatermarked: boolean("is_watermarked").default(true),
  processingStatus: varchar("processing_status").default("pending"), // pending, processing, completed, failed
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // for temporary download links
});

// Subscription history
export const subscriptionHistory = pgTable("subscription_history", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  tier: varchar("tier").notNull(),
  status: varchar("status").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency").default("usd"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertPdfRecordSchema = createInsertSchema(pdfRecords).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistory).omit({
  id: true,
  createdAt: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPdfRecord = z.infer<typeof insertPdfRecordSchema>;
export type PdfRecord = typeof pdfRecords.$inferSelect;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
