# Subscription Fix Deployment Checklist

## Immediate Actions Required

### 1. Update Stripe Webhook URL
- **Current (incorrect):** `https://yanked.chat/subscribe/api/stripe-webhook/`
- **Required (correct):** `https://yanked.chat/api/stripe-webhook`

**Steps:**
1. Go to [Stripe Dashboard Webhooks](https://dashboard.stripe.com/webhooks)
2. Find the webhook endpoint 
3. Edit the endpoint URL to: `https://yanked.chat/api/stripe-webhook`
4. Save changes

### 2. Create Required Firestore Indexes
Click these direct links to create the indexes:

1. **SubscriptionHistory Index**: [Create Now](https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=CmVwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9zdWJzY3JpcHRpb25IaXN0b3J5L2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI)

2. **PDFRecords Index**: [Create Now](https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=Clxwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wZGZSZWNvcmRzL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI)

**Note:** Index creation takes 5-10 minutes. The subscription errors will stop once indexes are built.

### 3. Add Missing Environment Variables (Railway)
Add these to Railway Dashboard → Variables:

```bash
# Client-side Stripe configuration
VITE_STRIPE_PRICING_TABLE_ID=prctbl_1RtfEmJF6bibA8neXrRMo3a
```

### 4. Verify Stripe Price Configuration
Ensure your Stripe pricing table uses **subscription** prices (not one-time payment prices).

## Expected Results After Fix

1. **Subscription page** will load pricing table without "Something went wrong" error
2. **Firestore errors** will disappear from logs
3. **User authentication and stats** will work properly  
4. **Webhook processing** will work with correct URL
5. **Recurring billing** will function correctly

## Validation Steps

1. **Check logs** for reduction in Firestore index errors
2. **Visit** https://yanked.chat/subscribe and verify pricing table loads
3. **Test subscription flow** with a test purchase
4. **Monitor webhook** events in Stripe Dashboard

## Files Changed in This Fix

- `Resources/stripe_service.ts` - Fixed payment mode subscription
- `client/src/pages/Subscribe.tsx` - Dynamic pricing table ID
- `DEPLOYMENT_TROUBLESHOOTING.md` - Enhanced with subscription fixes
- `RAILWAY_ENVIRONMENT_SETUP.md` - Added client-side variables
- `FIRESTORE_INDEXES.md` - New index creation guide
- `.env.example` - Added pricing table ID variable

## Timeline

- **Immediate:** Webhook URL change (< 5 minutes)
- **5-10 minutes:** Firestore index creation
- **Immediate:** Environment variable addition (< 2 minutes)
- **Total:** ~15 minutes for full deployment fix

The subscription system should be fully functional after completing these steps.