import { Router } from 'express';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    // Basic health status
    const healthData: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Add Railway-specific info if available
    if (process.env.RAILWAY_ENVIRONMENT) {
      healthData.railway = {
        environment: process.env.RAILWAY_ENVIRONMENT,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
        serviceId: process.env.RAILWAY_SERVICE_ID,
        projectId: process.env.RAILWAY_PROJECT_ID,
      };
    }

    // Test database connection if available
    try {
      if (process.env.DATABASE_URL) {
        const { db } = await import('../db');
        const { sql } = await import('drizzle-orm');
        
        // Simple connection test
        await db.execute(sql`SELECT 1`);
        healthData.database = 'connected';
        
        // Check for migration issues
        const constraintCheck = await db.execute(sql`
          SELECT conname FROM pg_constraint WHERE conname = 'users_email_unique'
        `);
        
        if (Array.isArray(constraintCheck) && constraintCheck.length > 0) {
          healthData.warning = 'users_email_unique constraint exists - may cause authentication failures';
          healthData.migrationRequired = true;
          healthData.migrationScript = 'migrations/fix-railway-deployment.sql';
        }
      }
    } catch (dbError) {
      healthData.database = 'error';
      healthData.databaseError = (dbError as Error).message;
    }

    res.status(200).json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

export default router;