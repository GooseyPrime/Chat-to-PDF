import admin from 'firebase-admin';
import type { RequestHandler } from "express";
import { storage } from "./storage";

// Initialize Firebase Admin (no service account needed for local development)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

export const verifyFirebaseToken: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add user info to request
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };

    // Always use Firebase UID as the primary key - NEVER check by email
    // Each Firebase UID should have its own separate user data
    const dbUser = await storage.upsertUser({
      id: decodedToken.uid, // Always use Firebase UID as database ID
      email: decodedToken.email || null,
      firstName: decodedToken.name?.split(' ')[0] || null,
      lastName: decodedToken.name?.split(' ').slice(1).join(' ') || null,
      profileImageUrl: decodedToken.picture || null,
    });
    
    // Always use the Firebase UID for database operations
    (req as any).user.uid = decodedToken.uid;

    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const isAuthenticated = verifyFirebaseToken;