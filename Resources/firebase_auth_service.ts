// server/services/authService.ts
import admin from 'firebase-admin';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { firebaseConfig, appConfig } from '../config/environment';
import { transactionStorage } from '../storage/transactionStorage';
import { nanoid } from 'nanoid';

interface AuthenticatedUser {
  uid: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  emailVerified: boolean;
  customClaims?: Record<string, any>;
  signInProvider?: string;
  lastSignIn?: Date;
}

interface AuthContext {
  user: AuthenticatedUser;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

class AuthService {
  private app: admin.app.App;
  private activeSessions = new Map<string, AuthContext>();
  private maxSessions = 10000;
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.initializeFirebase();
    this.startSessionCleanup();
  }

  private initializeFirebase(): void {
    try {
      // Check if Firebase Admin is already initialized
      if (admin.apps.length > 0) {
        this.app = admin.app();
        console.log('✅ Firebase Admin already initialized');
        return;
      }

      // Initialize with service account if provided
      if (firebaseConfig.privateKey && firebaseConfig.clientEmail) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            privateKey: firebaseConfig.privateKey,
            clientEmail: firebaseConfig.clientEmail,
          }),
          projectId: firebaseConfig.projectId,
        });
        console.log('✅ Firebase Admin initialized with service account');
      } else {
        // Initialize with application default credentials (for local development)
        this.app = admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
        console.log('✅ Firebase Admin initialized with default credentials');
      }
    } catch (error) {
      console.error('❌ Firebase Admin initialization failed:', error);
      throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token, true);
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        name: decodedToken.name || null,
        picture: decodedToken.picture || null,
        emailVerified: decodedToken.email_verified || false,
        customClaims: decodedToken.custom_claims || {},
        signInProvider: decodedToken.firebase?.sign_in_provider,
        lastSignIn: decodedToken.auth_time ? new Date(decodedToken.auth_time * 1000) : undefined,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error(`Invalid token: ${error instanceof Error ? error.message : 'Token verification failed'}`);
    }
  }

  async createUserSession(user: AuthenticatedUser, req: Request): Promise<string> {
    const sessionId = nanoid(32);
    const context: AuthContext = {
      user,
      sessionId,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
    };

    // Store session
    this.activeSessions.set(sessionId, context);
    
    // Manage session count
    this.cleanupOldSessions();

    console.log(`🔐 Session created: ${sessionId} for user ${user.uid}`);
    return sessionId;
  }

  getSession(sessionId: string): AuthContext | undefined {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return undefined;
    }

    // Check if session has expired
    const now = Date.now();
    const sessionAge = now - session.timestamp.getTime();
    
    if (sessionAge > this.sessionTimeout) {
      this.activeSessions.delete(sessionId);
      console.log(`⏰ Session expired: ${sessionId}`);
      return undefined;
    }

    return session;
  }

  revokeSession(sessionId: string): boolean {
    const deleted = this.activeSessions.delete(sessionId);
    if (deleted) {
      console.log(`🚪 Session revoked: ${sessionId}`);
    }
    return deleted;
  }

  revokeAllUserSessions(uid: string): number {
    let revokedCount = 0;
    
    for (const [sessionId, context] of this.activeSessions.entries()) {
      if (context.user.uid === uid) {
        this.activeSessions.delete(sessionId);
        revokedCount++;
      }
    }
    
    if (revokedCount > 0) {
      console.log(`🚪 Revoked ${revokedCount} sessions for user ${uid}`);
    }
    
    return revokedCount;
  }

  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return req.socket.remoteAddress || 'unknown';
  }

  private cleanupOldSessions(): void {
    if (this.activeSessions.size <= this.maxSessions) {
      return;
    }

    const now = Date.now();
    const sessionsToDelete: string[] = [];

    // Find expired sessions
    for (const [sessionId, context] of this.activeSessions.entries()) {
      const sessionAge = now - context.timestamp.getTime();
      if (sessionAge > this.sessionTimeout) {
        sessionsToDelete.push(sessionId);
      }
    }

    // Delete expired sessions
    sessionsToDelete.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
    });

    // If still over limit, delete oldest sessions
    if (this.activeSessions.size > this.maxSessions) {
      const sessions = Array.from(this.activeSessions.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toDelete = sessions.slice(0, sessions.length - this.maxSessions);
      toDelete.forEach(([sessionId]) => {
        this.activeSessions.delete(sessionId);
      });
    }

    if (sessionsToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${sessionsToDelete.length} expired sessions`);
    }
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupOldSessions();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  getSessionStats(): {
    totalSessions: number;
    uniqueUsers: number;
    averageSessionAge: number;
    oldestSession: Date | null;
  } {
    const now = Date.now();
    const userSessions = new Set<string>();
    let totalAge = 0;
    let oldestTimestamp = now;

    for (const context of this.activeSessions.values()) {
      userSessions.add(context.user.uid);
      const age = now - context.timestamp.getTime();
      totalAge += age;
      
      if (context.timestamp.getTime() < oldestTimestamp) {
        oldestTimestamp = context.timestamp.getTime();
      }
    }

    return {
      totalSessions: this.activeSessions.size,
      uniqueUsers: userSessions.size,
      averageSessionAge: this.activeSessions.size > 0 ? totalAge / this.activeSessions.size : 0,
      oldestSession: this.activeSessions.size > 0 ? new Date(oldestTimestamp) : null,
    };
  }

  // Middleware factory
  createAuthMiddleware(options: {
    required?: boolean;
    allowedRoles?: string[];
    rateLimitPerMinute?: number;
  } = {}): RequestHandler {
    const {
      required = true,
      allowedRoles = [],
      rateLimitPerMinute = 60,
    } = options;

    // Simple rate limiting per IP
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Rate limiting
        if (rateLimitPerMinute > 0) {
          const clientIP = this.getClientIP(req);
          const now = Date.now();
          const minute = Math.floor(now / 60000);
          
          const rateLimitKey = `${clientIP}:${minute}`;
          const current = requestCounts.get(rateLimitKey) || { count: 0, resetTime: minute };
          
          if (current.count >= rateLimitPerMinute) {
            return res.status(429).json({ 
              error: 'Rate limit exceeded',
              message: `Too many requests. Limit: ${rateLimitPerMinute} per minute`,
              retryAfter: 60 - (now % 60000) / 1000,
            });
          }
          
          requestCounts.set(rateLimitKey, { 
            count: current.count + 1, 
            resetTime: minute 
          });
          
          // Cleanup old rate limit entries
          if (requestCounts.size > 10000) {
            for (const [key, data] of requestCounts.entries()) {
              if (data.resetTime < minute - 5) { // Keep last 5 minutes
                requestCounts.delete(key);
              }
            }
          }
        }

        // Check for auth header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          if (required) {
            return res.status(401).json({ 
              error: 'Authentication required',
              message: 'No valid authorization header provided'
            });
          }
          return next();
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
          if (required) {
            return res.status(401).json({ 
              error: 'Authentication required',
              message: 'Invalid token format'
            });
          }
          return next();
        }

        // Verify token and create/update user
        const authenticatedUser = await this.verifyToken(token);
        
        // Sync user with database
        const dbUser = await transactionStorage.upsertUser({
          id: authenticatedUser.uid,
          email: authenticatedUser.email,
          firstName: authenticatedUser.name?.split(' ')[0] || null,
          lastName: authenticatedUser.name?.split(' ').slice(1).join(' ') || null,
          profileImageUrl: authenticatedUser.picture,
        });

        // Check role restrictions
        if (allowedRoles.length > 0) {
          const userRoles = authenticatedUser.customClaims?.roles || [];
          const hasAllowedRole = allowedRoles.some(role => userRoles.includes(role));
          
          if (!hasAllowedRole) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              message: `Required roles: ${allowedRoles.join(', ')}`,
              userRoles: userRoles,
            });
          }
        }

        // Create session and attach to request
        const sessionId = await this.createUserSession(authenticatedUser, req);
        
        // Attach user data to request
        (req as any).user = authenticatedUser;
        (req as any).sessionId = sessionId;
        (req as any).dbUser = dbUser;

        next();
      } catch (error) {
        console.error('Authentication middleware error:', error);
        
        if (required) {
          return res.status(401).json({
            error: 'Authentication failed',
            message: error instanceof Error ? error.message : 'Token verification failed',
          });
        }
        
        next();
      }
    };
  }
}

export const authService = new AuthService();

// Export middleware variants for convenience
export const requireAuth = authService.createAuthMiddleware({ required: true });
export const optionalAuth = authService.createAuthMiddleware({ required: false });
export const requireAdmin = authService.createAuthMiddleware({ 
  required: true, 
  allowedRoles: ['admin'] 
});

// Legacy middleware for backward compatibility
export const isAuthenticated = requireAuth;
export const verifyFirebaseToken = requireAuth;