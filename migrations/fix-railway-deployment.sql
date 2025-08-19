-- Railway Deployment Fix Migration
-- This migration addresses the database constraint issues causing Railway deployment failures
-- 
-- Issues Fixed:
-- 1. Remove users.email unique constraint (allows multiple Firebase UIDs with same email)
-- 2. Add ON DELETE CASCADE to foreign key constraints
--
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- 1. Remove the unique constraint on users.email if it exists
-- This allows multiple Firebase UIDs to have the same email address
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_unique;
        RAISE NOTICE 'Removed users_email_unique constraint';
    ELSE
        RAISE NOTICE 'users_email_unique constraint does not exist, skipping';
    END IF;
END $$;

-- 2. Update pdf_records foreign key to add ON DELETE CASCADE
-- This prevents foreign key violations when users are deleted/updated
DO $$
BEGIN
    -- Check if the constraint exists and doesn't have CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'pdf_records_user_id_users_id_fk'
        AND delete_rule != 'CASCADE'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE pdf_records DROP CONSTRAINT pdf_records_user_id_users_id_fk;
        
        -- Add new constraint with CASCADE
        ALTER TABLE pdf_records ADD CONSTRAINT pdf_records_user_id_users_id_fk 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            
        RAISE NOTICE 'Updated pdf_records foreign key with ON DELETE CASCADE';
    ELSE
        RAISE NOTICE 'pdf_records foreign key already has CASCADE or does not exist';
    END IF;
END $$;

-- 3. Update subscription_history foreign key to add ON DELETE CASCADE
-- This prevents foreign key violations when users are deleted/updated
DO $$
BEGIN
    -- Check if the constraint exists and doesn't have CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'subscription_history_user_id_users_id_fk'
        AND delete_rule != 'CASCADE'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE subscription_history DROP CONSTRAINT subscription_history_user_id_users_id_fk;
        
        -- Add new constraint with CASCADE
        ALTER TABLE subscription_history ADD CONSTRAINT subscription_history_user_id_users_id_fk 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            
        RAISE NOTICE 'Updated subscription_history foreign key with ON DELETE CASCADE';
    ELSE
        RAISE NOTICE 'subscription_history foreign key already has CASCADE or does not exist';
    END IF;
END $$;

-- 4. Create an index on users.email for performance (non-unique)
-- Since we removed the unique constraint, we should ensure queries are still fast
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'users_email_idx'
    ) THEN
        CREATE INDEX users_email_idx ON users(email);
        RAISE NOTICE 'Created non-unique index on users.email';
    ELSE
        RAISE NOTICE 'users_email_idx already exists';
    END IF;
END $$;

COMMIT;

-- Verification queries - Run these after migration to verify success
-- You can uncomment these to check the migration results:

-- Check that unique constraint is removed:
-- SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique';

-- Check foreign key constraints have CASCADE:
-- SELECT constraint_name, delete_rule 
-- FROM information_schema.referential_constraints 
-- WHERE constraint_name IN ('pdf_records_user_id_users_id_fk', 'subscription_history_user_id_users_id_fk');

-- Check that email index exists:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'users_email_idx';