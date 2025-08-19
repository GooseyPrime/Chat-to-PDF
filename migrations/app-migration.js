#!/usr/bin/env node
/**
 * App-side migration script for Railway deployment fixes
 * This script can be run in environments where direct SQL access isn't available
 * 
 * Usage: node migrations/app-migration.js
 */

import { db } from '../dist/server/db.js';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🚀 Starting Railway deployment fix migration...');
  
  try {
    // Start transaction
    await db.execute(sql`BEGIN`);
    
    console.log('1. Checking and removing users.email unique constraint...');
    
    // Check if unique constraint exists
    const uniqueConstraintResult = await db.execute(sql`
      SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique'
    `);
    
    if (uniqueConstraintResult.length > 0) {
      await db.execute(sql`ALTER TABLE users DROP CONSTRAINT users_email_unique`);
      console.log('   ✅ Removed users_email_unique constraint');
    } else {
      console.log('   ℹ️  users_email_unique constraint does not exist, skipping');
    }
    
    console.log('2. Updating pdf_records foreign key constraint...');
    
    // Check current foreign key constraint
    const pdfFkResult = await db.execute(sql`
      SELECT constraint_name, delete_rule 
      FROM information_schema.referential_constraints 
      WHERE constraint_name = 'pdf_records_user_id_users_id_fk'
    `);
    
    if (pdfFkResult.length > 0 && pdfFkResult[0].delete_rule !== 'CASCADE') {
      // Drop and recreate with CASCADE
      await db.execute(sql`ALTER TABLE pdf_records DROP CONSTRAINT pdf_records_user_id_users_id_fk`);
      await db.execute(sql`
        ALTER TABLE pdf_records ADD CONSTRAINT pdf_records_user_id_users_id_fk 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✅ Updated pdf_records foreign key with ON DELETE CASCADE');
    } else {
      console.log('   ℹ️  pdf_records foreign key already has CASCADE or does not exist');
    }
    
    console.log('3. Updating subscription_history foreign key constraint...');
    
    // Check current foreign key constraint
    const subFkResult = await db.execute(sql`
      SELECT constraint_name, delete_rule 
      FROM information_schema.referential_constraints 
      WHERE constraint_name = 'subscription_history_user_id_users_id_fk'
    `);
    
    if (subFkResult.length > 0 && subFkResult[0].delete_rule !== 'CASCADE') {
      // Drop and recreate with CASCADE
      await db.execute(sql`ALTER TABLE subscription_history DROP CONSTRAINT subscription_history_user_id_users_id_fk`);
      await db.execute(sql`
        ALTER TABLE subscription_history ADD CONSTRAINT subscription_history_user_id_users_id_fk 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✅ Updated subscription_history foreign key with ON DELETE CASCADE');
    } else {
      console.log('   ℹ️  subscription_history foreign key already has CASCADE or does not exist');
    }
    
    console.log('4. Creating non-unique index on users.email...');
    
    // Check if index exists
    const indexResult = await db.execute(sql`
      SELECT indexname FROM pg_indexes WHERE indexname = 'users_email_idx'
    `);
    
    if (indexResult.length === 0) {
      await db.execute(sql`CREATE INDEX users_email_idx ON users(email)`);
      console.log('   ✅ Created non-unique index on users.email');
    } else {
      console.log('   ℹ️  users_email_idx already exists');
    }
    
    // Commit transaction
    await db.execute(sql`COMMIT`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ Database constraints have been fixed for Railway deployment');
    
    // Verification
    console.log('\n📋 Verifying migration results...');
    
    const verifyConstraints = await db.execute(sql`
      SELECT constraint_name, delete_rule 
      FROM information_schema.referential_constraints 
      WHERE constraint_name IN ('pdf_records_user_id_users_id_fk', 'subscription_history_user_id_users_id_fk')
    `);
    
    console.log('Foreign key constraints:');
    verifyConstraints.forEach(row => {
      console.log(`   ${row.constraint_name}: ${row.delete_rule}`);
    });
    
    const verifyUnique = await db.execute(sql`
      SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique'
    `);
    
    console.log(`Email unique constraint: ${verifyUnique.length > 0 ? '⚠️  Still exists' : '✅ Removed'}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    try {
      await db.execute(sql`ROLLBACK`);
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('❌ Failed to rollback transaction:', rollbackError);
    }
    
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { runMigration };