# replit.md

## Overview

GPTPDF is a web application that converts AI chat conversations (from ChatGPT, Claude, and Gemini) into professionally formatted PDF documents. The application features a React frontend built with Vite, an Express.js backend, PostgreSQL database with Drizzle ORM, Replit authentication, and Stripe payment integration for subscription management.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend and backend:

- **Frontend**: React with TypeScript, Vite bundler, Tailwind CSS for styling, shadcn/ui component library
- **Backend**: Express.js server with TypeScript, session-based authentication via Replit Auth
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **PDF Generation**: Puppeteer with Chrome for server-side PDF rendering
- **Payments**: Stripe integration for subscription management

## Key Components

### Frontend Architecture
- **Build System**: Vite with TypeScript, configured for React development
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Hook-based auth state management with automatic redirects

### Backend Architecture
- **Server Framework**: Express.js with TypeScript for API endpoints
- **Authentication**: Replit Auth with OpenID Connect, session storage in PostgreSQL
- **Database Layer**: Drizzle ORM with Neon serverless PostgreSQL
- **PDF Processing**: Puppeteer with chrome-launcher for Replit compatibility
- **Payment Processing**: Stripe webhooks and API integration
- **File Storage**: Local file system with download URLs

### Database Schema
- **users**: User profiles with subscription status and usage tracking
- **sessions**: Session storage for Replit Auth
- **pdfRecords**: Generated PDF metadata and processing status
- **subscriptionHistory**: Audit trail for subscription changes

## Data Flow

1. **Authentication Flow**: Users authenticate via Replit Auth, sessions stored in PostgreSQL
2. **PDF Generation**: User submits URL → Server validates → Puppeteer processes → PDF stored with metadata
3. **Usage Tracking**: Daily usage limits enforced per subscription tier (basic/pro)
4. **Payment Flow**: Stripe handles subscription creation/management with webhook updates
5. **Download Flow**: PDF records track file paths for secure download access

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database
- **chrome-launcher**: Chrome browser management for Puppeteer in Replit environment
- **puppeteer-core**: Headless Chrome automation for PDF generation
- **stripe**: Payment processing and subscription management
- **drizzle-orm**: Type-safe database toolkit with PostgreSQL support

### Frontend Dependencies
- **@radix-ui/***: Accessible UI primitives for component library
- **@tanstack/react-query**: Server state management and caching
- **@stripe/stripe-js**: Client-side Stripe integration
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Minimal routing library for React

### Development Dependencies
- **vite**: Fast build tool and development server
- **typescript**: Type checking and compilation
- **drizzle-kit**: Database migrations and schema management

## Deployment Strategy

The application is designed for Replit deployment with specific considerations:

- **Chrome Binary**: Uses chrome-launcher for Replit-compatible Chrome execution
- **Environment Variables**: Requires DATABASE_URL, Stripe keys, session secrets, and Replit domain configuration
- **Build Process**: Vite builds frontend to dist/public, esbuild bundles server to dist/
- **Session Storage**: PostgreSQL-backed sessions for horizontal scaling
- **File Storage**: Local filesystem with relative paths for PDF storage

The deployment supports both development and production modes with appropriate middleware and error handling.

## Changelog

```
Changelog:
- July 01, 2025. Initial setup
- July 01, 2025. Complete monetization strategy implemented:
  * Three-tier pricing: Basic Weekly ($4.99/week), Pro Monthly ($9.99/month), Pro Annual ($59.99/year)
  * Tier-based feature restrictions: Basic limited to 3 PDFs/day and ChatGPT only, Pro gets unlimited PDFs and all platforms
  * Watermark system: Basic tier shows watermarks, Pro tiers remove watermarks
  * Enhanced subscription UI with plan selection flow and Stripe integration
- July 31, 2025. Payment system fully functional:
  * Fixed Stripe webhook endpoint with proper raw body handling for signature verification
  * One-time payment processing working with promo code support and user info collection
  * Subscription status updates correctly after payment success
  * Installed Chrome for Puppeteer-based PDF generation
  * Frontend subscription cards display correct plan status after payment
- August 08, 2025. Subscription expiration system implemented:
  * Automatic subscription expiration checking before user access
  * Background job runs every hour to expire expired subscriptions
  * Proper subscription period tracking in subscription history table
  * User access immediately blocked when subscription expires
  * Admin endpoint for manual subscription expiration management
- August 18, 2025. Fixed webhook timing and message channel issues:
  * Resolved message channel closure errors with immediate webhook responses
  * Added payment success handling with user feedback
  * Improved error handling and retry logic for network requests
  * Enhanced webhook logging for better debugging capabilities
  * Fixed subscription redirect timing to prevent browser conflicts
- August 19, 2025. Complete authentication and data isolation fix:
  * Removed database email unique constraint to allow multiple Firebase UIDs with same email
  * Migrated legacy user data (7 PDFs, Stripe customer ID) to Firebase UID user
  * Fixed user isolation - each Firebase UID now gets completely separate data
  * Updated webhook secret to use environment variable (STRIPE_WEBHOOK_SECRET)
  * Improved webhook error handling to always return 200 OK responses
  * Note: Stripe webhook URL needs trailing slash to prevent 307 redirects
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```