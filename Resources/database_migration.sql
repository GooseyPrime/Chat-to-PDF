-- Database Migration Script
-- Run this to update your existing database with the new optimized schema

-- =================================
-- Create updated tables if they don't exist
-- =================================

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Enhanced users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY NOT NULL,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  stripe_customer_id VARCHAR,
  stripe_subscription_id VARCHAR,
  subscription_status VARCHAR DEFAULT 'inactive',
  subscription_tier VARCHAR,
  daily_usage INTEGER DEFAULT 0,
  last_usage_reset TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced PDF records table
CREATE TABLE IF NOT EXISTS pdf_records (
  id VARCHAR PRIMARY KEY NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  platform VARCHAR NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  is_watermarked BOOLEAN DEFAULT true,
  processing_status VARCHAR DEFAULT 'pending',
  download_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Enhanced subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id VARCHAR PRIMARY KEY NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR,
  tier VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  amount DECIMAL(10, 2),
  currency VARCHAR DEFAULT 'usd',
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =================================
-- Add missing columns to existing tables
-- =================================

-- Add new columns to users table if they don't exist
DO $$ 
BEGIN
  -- Subscription management columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status') THEN
    ALTER TABLE users ADD COLUMN subscription_status VARCHAR DEFAULT 'inactive';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_tier') THEN
    ALTER TABLE users ADD COLUMN subscription_tier VARCHAR;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='daily_usage') THEN
    ALTER TABLE users ADD COLUMN daily_usage INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_usage_reset') THEN
    ALTER TABLE users ADD COLUMN last_usage_reset TIMESTAMP DEFAULT NOW();
  END IF;
  
  -- Stripe integration columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR;
  END IF;
END $$;

-- Add new columns to pdf_records table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdf_records' AND column_name='is_watermarked') THEN
    ALTER TABLE pdf_records ADD COLUMN is_watermarked BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdf_records' AND column_name='expires_at') THEN
    ALTER TABLE pdf_records ADD COLUMN expires_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdf_records' AND column_name='platform') THEN
    ALTER TABLE pdf_records ADD COLUMN platform VARCHAR DEFAULT 'unknown';
  END IF;
END $$;

-- Add new columns to subscription_history table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_history' AND column_name='amount') THEN
    ALTER TABLE subscription_history ADD COLUMN amount DECIMAL(10, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_history' AND column_name='currency') THEN
    ALTER TABLE subscription_history ADD COLUMN currency VARCHAR DEFAULT 'usd';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_history' AND column_name='period_start') THEN
    ALTER TABLE subscription_history ADD COLUMN period_start TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_history' AND column_name='period_end') THEN
    ALTER TABLE subscription_history ADD COLUMN period_end TIMESTAMP;
  END IF;
END $$;

-- =================================
-- Create performance indexes
-- =================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_daily_usage_reset ON users(last_usage_reset);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- PDF records indexes
CREATE INDEX IF NOT EXISTS idx_pdf_records_user_id ON pdf_records(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_records_status ON pdf_records(processing_status);
CREATE INDEX IF NOT EXISTS idx_pdf_records_created_at ON pdf_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_records_expires_at ON pdf_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_pdf_records_platform ON pdf_records(platform);

-- Subscription history indexes
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status ON subscription_history(status);
CREATE INDEX IF NOT EXISTS idx_subscription_history_tier ON subscription_history(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_period_end ON subscription_history(period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_history_active_user ON subscription_history(user_id, status) WHERE status = 'active';

-- =================================
-- Update existing data (if needed)
-- =================================

-- Set default values for existing records
UPDATE users 
SET subscription_status = 'inactive' 
WHERE subscription_status IS NULL;

UPDATE users 
SET daily_usage = 0 
WHERE daily_usage IS NULL;

UPDATE users 
SET last_usage_reset = NOW() 
WHERE last_usage_reset IS NULL;

UPDATE pdf_records 
SET is_watermarked = true 
WHERE is_watermarked IS NULL;

UPDATE pdf_records 
SET platform = CASE 
  WHEN original_url LIKE '%chatgpt.com%' OR original_url LIKE '%openai.com%' THEN 'chatgpt'
  WHEN original_url LIKE '%claude.ai%' THEN 'claude'
  WHEN original_url LIKE '%gemini.google.com%' OR original_url LIKE '%bard.google.com%' THEN 'gemini'
  ELSE 'unknown'
END
WHERE platform IS NULL OR platform = '';

-- =================================
-- Clean up orphaned records
-- =================================

-- Remove PDF records without valid users
DELETE FROM pdf_records 
WHERE user_id NOT IN (SELECT id FROM users);

-- Remove subscription history without valid users
DELETE FROM subscription_history 
WHERE user_id NOT IN (SELECT id FROM users);

-- Remove expired PDF records older than 30 days
DELETE FROM pdf_records 
WHERE expires_at IS NOT NULL 
AND expires_at < NOW() - INTERVAL '30 days';

-- =================================
-- Create helpful views for analytics
-- =================================

-- Active subscriptions view
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
  u.id,
  u.email,
  u.subscription_tier,
  u.subscription_status,
  sh.amount,
  sh.period_start,
  sh.period_end,
  EXTRACT(DAY FROM sh.period_end - NOW()) as days_remaining
FROM users u
JOIN subscription_history sh ON u.id = sh.user_id
WHERE u.subscription_status = 'active'
AND sh.status = 'active'
AND sh.period_end > NOW()
ORDER BY sh.period_end ASC;

-- User usage statistics view
CREATE OR REPLACE VIEW user_usage_stats AS
SELECT 
  u.id,
  u.email,
  u.subscription_tier,
  u.daily_usage,
  COUNT(pr.id) as total_pdfs,
  COUNT(CASE WHEN pr.created_at::date = CURRENT_DATE THEN 1 END) as today_pdfs,
  COUNT(CASE WHEN pr.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as week_pdfs,
  COUNT(CASE WHEN pr.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as month_pdfs
FROM users u
LEFT JOIN pdf_records pr ON u.id = pr.user_id
GROUP BY u.id, u.email, u.subscription_tier, u.daily_usage;

-- =================================
-- Permissions and security
-- =================================

-- Ensure proper permissions (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- =================================
-- Verification queries
-- =================================

-- Verify the migration
SELECT 
  'users' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_users
FROM users
UNION ALL
SELECT 
  'pdf_records' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed_pdfs
FROM pdf_records
UNION ALL
SELECT 
  'subscription_history' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions
FROM subscription_history;

-- Check for any data issues
SELECT 
  'Orphaned PDF records' as issue,
  COUNT(*) as count
FROM pdf_records pr
LEFT JOIN users u ON pr.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 
  'Users with missing usage reset date' as issue,
  COUNT(*) as count
FROM users
WHERE last_usage_reset IS NULL
UNION ALL
SELECT 
  'PDF records without platform' as issue,
  COUNT(*) as count
FROM pdf_records
WHERE platform IS NULL OR platform = '';

COMMIT;