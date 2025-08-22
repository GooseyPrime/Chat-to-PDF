import { Router } from 'express';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    // Basic health status
    const healthData: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'firestore'
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

    // Test Firebase Firestore connection
    try {
      const { ensureFirestore } = await import('../db');
      await ensureFirestore();
      healthData.firebase = {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        connected: true
      };
    } catch (dbError) {
      // Don't fail the entire health check if Firebase is unavailable
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      healthData.firebase = {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        connected: false,
        error: errorMessage
      };
      console.warn('Firebase connection failed during health check:', errorMessage);
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