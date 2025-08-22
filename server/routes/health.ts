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

    // Test Firebase Firestore connection with detailed reporting
    try {
      const { ensureFirestore } = await import('../db');
      await ensureFirestore();
      healthData.firebase = {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        connected: true,
        authMethod: process.env.GOOGLE_CREDENTIALS ? 'GOOGLE_CREDENTIALS' : 
                   (process.env.FIREBASE_PRIVATE_KEY ? 'individual_credentials' : 'default'),
        timestamp: new Date().toISOString()
      };
    } catch (dbError) {
      // Provide detailed error information for debugging
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      healthData.firebase = {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        connected: false,
        error: errorMessage,
        authMethod: process.env.GOOGLE_CREDENTIALS ? 'GOOGLE_CREDENTIALS' : 
                   (process.env.FIREBASE_PRIVATE_KEY ? 'individual_credentials' : 'default'),
        timestamp: new Date().toISOString(),
        troubleshooting: {
          hasProjectId: !!(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
          hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
          hasIndividualCredentials: !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL),
          firestoreUrl: `https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'unknown'}/firestore`,
          suggestion: errorMessage.includes('NOT_FOUND') || errorMessage.includes('5') ? 
            'Enable Firestore database in Firebase Console' :
            errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('7') ?
            'Check service account permissions' :
            'Verify Firebase configuration and credentials'
        }
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

// Client configuration endpoint - provides public Firebase config when available
router.get('/config', (_req, res) => {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const appId = process.env.VITE_FIREBASE_APP_ID;
    
    // Only provide config if we have the essential values
    if (projectId && apiKey && appId) {
      res.json({
        firebase: {
          apiKey,
          authDomain: `${projectId}.firebaseapp.com`,
          projectId,
          storageBucket: `${projectId}.firebasestorage.app`,
          appId,
        },
        available: true
      });
    } else {
      res.json({
        firebase: null,
        available: false,
        reason: 'Firebase client configuration not available'
      });
    }
  } catch (error) {
    res.status(500).json({
      firebase: null,
      available: false,
      error: (error as Error).message
    });
  }
});

export default router;