# CSP Configuration for Browser Extensions

## Issue
Browser extensions were causing console errors in development: `Failed to load resource: net::ERR_FAILED` from `chrome-extension://invalid/`. This happens because extensions try to inject scripts into pages with strict Content Security Policy (CSP) headers.

## Solution
Implemented environment-aware CSP configuration in `server/index.ts`:

### Development Environment
- Allows `chrome-extension:` and `moz-extension:` schemes in `script-src` and `connect-src` directives
- Reduces console noise from browser extensions during development
- Improves developer experience without compromising security

### Production Environment  
- Maintains strict CSP policy without extension schemes
- Preserves security for deployed applications
- No changes to production security posture

## Implementation
```typescript
// Environment-aware CSP directives
const cspDirectives = [
  "default-src 'self'",
  appConfig.isDevelopment 
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com chrome-extension: moz-extension:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com",
  // ... other directives
  appConfig.isDevelopment
    ? "connect-src 'self' https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com wss://ws-us3.pusher.com chrome-extension: moz-extension:"
    : "connect-src 'self' https://api.stripe.com https://*.googleapis.com https://*.firebaseio.com wss://ws-us3.pusher.com",
];
```

## Security Notes
- **Production**: No browser extension schemes allowed, maintains strict security
- **Development**: Extension schemes allowed only for improved DX, still requires HTTPS origins for external resources
- **Environment Detection**: Uses validated `appConfig.isDevelopment` from environment configuration

## Testing
Validated with:
- TypeScript compilation (`npm run check`)
- Production build (`npm run build`) 
- Environment-specific CSP generation tests
- Confirmed production CSP excludes extension schemes
- Confirmed development CSP includes extension schemes

This change resolves issue #76 while maintaining security best practices.