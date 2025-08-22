// server/config/environment.ts
import { z } from 'zod';

// Railway-aware environment validation schema
const envSchema = z.object({
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'STRIPE_PUBLISHABLE_KEY must start with pk_'),
  
  // Stripe Price IDs
  STRIPE_BASIC_WEEKLY_PRICE_ID: z.string().startsWith('price_', 'Invalid price ID format'),
  STRIPE_PRO_WEEKLY_PRICE_ID: z.string().startsWith('price_', 'Invalid price ID format'),
  STRIPE_PRO_ANNUAL_PRICE_ID: z.string().startsWith('price_', 'Invalid price ID format'),
  
  // Firebase Configuration
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  
  // Google Cloud credentials (preferred method)
  GOOGLE_CREDENTIALS: z.string().optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).optional(),
  
  // Railway-specific
  RAILWAY_PORT: z.string().regex(/^\d+$/).transform(Number).optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),
  RAILWAY_PROJECT_ID: z.string().optional(),
  RAILWAY_SERVICE_ID: z.string().optional(),
  RAILWAY_DEPLOYMENT_ID: z.string().optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  RAILWAY_STATIC_URL: z.string().optional(),
  
  // Security
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // Storage
  STORAGE_PATH: z.string().default('/tmp'),
  
  // Application URLs
  APP_URL: z.string().url().optional(),
  CLIENT_URL: z.string().url().optional(),
});

export type Environment = z.infer<typeof envSchema>;

// Railway detection
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;

// Validate and export environment
export function validateEnvironment(): Environment {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n📝 Required environment variables for Railway:');
      console.error('  STRIPE_SECRET_KEY=sk_live_...');
      console.error('  STRIPE_WEBHOOK_SECRET=whsec_...');
      console.error('  STRIPE_PUBLISHABLE_KEY=pk_live_...');
      console.error('  STRIPE_BASIC_WEEKLY_PRICE_ID=price_...');
      console.error('  STRIPE_PRO_WEEKLY_PRICE_ID=price_...');
      console.error('  STRIPE_PRO_ANNUAL_PRICE_ID=price_...');
      console.error('  FIREBASE_PROJECT_ID=your-project-id');

      console.error('  GOOGLE_CREDENTIALS={"type":"service_account",...} (recommended)');
      console.error('    OR');

      console.error('  FIREBASE_PRIVATE_KEY=[Copy private key from Firebase JSON with actual line breaks]');
      console.error('  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com');
      console.error('  SESSION_SECRET=your-secret-key');
      console.error('  NODE_ENV=production');
      if (isRailway) {
        console.error('\n🚂 Railway deployment detected.');
        console.error('   Set these variables in Railway Dashboard → Variables');
      }
      process.exit(1);
    }
    throw error;
  }
}

// Export validated environment
export const env = validateEnvironment();

// Stripe configuration with validated environment
export const stripeConfig = {
  secretKey: env.STRIPE_SECRET_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  priceIds: {
    basicWeekly: env.STRIPE_BASIC_WEEKLY_PRICE_ID,
    proWeekly: env.STRIPE_PRO_WEEKLY_PRICE_ID,
    proAnnual: env.STRIPE_PRO_ANNUAL_PRICE_ID,
  },
};

// Firebase configuration
export const firebaseConfig = {
  projectId: env.FIREBASE_PROJECT_ID,
  privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: env.FIREBASE_CLIENT_EMAIL,


  googleCredentials: env.GOOGLE_CREDENTIALS,
};

// Database configuration - removed, now using Firebase Firestore
// export const dbConfig = { ... };

// Railway-aware application configuration
export const appConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT || env.RAILWAY_PORT || 5000,
  storagePath: env.STORAGE_PATH || (isRailway ? '/app/storage' : '/tmp'),
  sessionSecret: env.SESSION_SECRET,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isRailway,
  
  // Railway-specific URLs
  appUrl: env.APP_URL || 
    (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : 
     env.RAILWAY_STATIC_URL || 
     `http://localhost:${env.PORT || env.RAILWAY_PORT || 5000}`),
     
  clientUrl: env.CLIENT_URL || 
    (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : 
     env.RAILWAY_STATIC_URL || 
     `http://localhost:${env.PORT || env.RAILWAY_PORT || 5000}`),
  
  // Railway metadata
  railway: {
    environment: env.RAILWAY_ENVIRONMENT,
    projectId: env.RAILWAY_PROJECT_ID,
    serviceId: env.RAILWAY_SERVICE_ID,
    deploymentId: env.RAILWAY_DEPLOYMENT_ID,
    publicDomain: env.RAILWAY_PUBLIC_DOMAIN,
    staticUrl: env.RAILWAY_STATIC_URL,
  },
};