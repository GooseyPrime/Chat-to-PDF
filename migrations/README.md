# Railway Deployment Migration Guide

This document provides a quick reference for the database migration fixes implemented to resolve Railway deployment issues.

## Issues Fixed

1. **Email Unique Constraint**: Removed `users_email_unique` constraint that prevented multiple Firebase UIDs from having the same email
2. **Foreign Key Cascades**: Added `ON DELETE CASCADE` to foreign key relationships to prevent constraint violations
3. **Build Compatibility**: Fixed Windows-specific build commands for cross-platform compatibility

## Migration Options

### Option 1: SQL Migration (Recommended)
```bash
psql $DATABASE_URL < migrations/fix-railway-deployment.sql
```

### Option 2: App-side Migration (Alternative)
```bash
node migrations/app-migration.js
```

## Verification

After running the migration, verify success:

```bash
# Check health endpoint
curl https://your-app.railway.app/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "database": "connected"
}
```

## Pre-deployment Verification

Always run before deploying:
```bash
./scripts/verify-deployment.sh
```

## Files Modified

- `shared/schema.ts`: Updated schema definitions
- `server/routes.ts`: Enhanced health endpoint
- `package.json`: Fixed cross-platform build command
- `scripts/verify-deployment.sh`: Enhanced verification
- `README.md`: Comprehensive deployment guide

## Safety Notes

- All migrations are idempotent (safe to run multiple times)
- Database changes are wrapped in transactions
- Rollback procedures are included in app-side migration
- No data loss - only constraint modifications

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Ensure migration was run successfully
4. Check health endpoint for database connectivity
5. Review troubleshooting section in README.md