# Subscription Administration Guide

This guide explains how to manage user subscription tiers using the provided admin tools.

## Overview

The pricing system supports three tiers:
- **Starter**: $49/month, 25 validations/month
- **Pro**: $99/month, 100 validations/month  
- **Enterprise**: $199/month, unlimited validations

## Available Tools

### 1. Node.js CLI Script

The most comprehensive tool for subscription management.

**Location**: `scripts/update_user_subscription_tier.js`

#### Setup

```bash
# 1. Install dependencies (already done if running Next.js app)
npm install @supabase/supabase-js dotenv

# 2. Add the service role key to your .env.local file
# This key has admin privileges and should be kept secure
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here" >> .env.local

# 3. Your .env.local should now contain:
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Finding Your Service Role Key

1. Go to your Supabase dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (not the anon key)
4. Add it to your `.env.local` file as `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Security Warning**: The service role key bypasses Row Level Security and has admin privileges. Never commit it to version control or expose it publicly.

#### Usage Examples

```bash
# List all current subscriptions
node scripts/update_user_subscription_tier.js --list

# Upgrade user to Pro plan (monthly billing, change at period end)
node scripts/update_user_subscription_tier.js user@example.com pro monthly

# Upgrade to Enterprise with yearly billing (immediate change)
node scripts/update_user_subscription_tier.js user@example.com enterprise yearly --immediate

# Downgrade to Starter (will warn about usage limits)
node scripts/update_user_subscription_tier.js user@example.com starter

# Get help
node scripts/update_user_subscription_tier.js --help
```

#### Features

- ✅ Validates user existence and plan availability
- ✅ Checks current usage against new plan limits
- ✅ Supports immediate or end-of-period changes
- ✅ Preserves Stripe customer information
- ✅ Detailed logging and error handling
- ✅ Usage warnings for downgrades

### 2. TypeScript Admin Service

For integration into your application code.

**Location**: `src/lib/admin/subscriptionAdmin.ts`

#### Usage Example

```typescript
import { subscriptionAdmin } from '@/lib/admin/subscriptionAdmin'

// Update subscription
const result = await subscriptionAdmin.updateSubscriptionTier({
  userEmail: 'user@example.com',
  newPlanName: 'pro',
  billingCycle: 'monthly',
  immediate: false,
  reason: 'Customer upgrade request'
})

if (result.success) {
  console.log('Success:', result.message)
  console.log('New subscription:', result.newSubscription)
} else {
  console.error('Error:', result.message)
}

// Grant free trial
const trialResult = await subscriptionAdmin.grantFreeTrial(
  'newuser@example.com',
  'pro',
  7 // 7 days
)

// Bulk update multiple users
const bulkResults = await subscriptionAdmin.bulkUpdateSubscriptions([
  { userEmail: 'user1@example.com', newPlanName: 'pro' },
  { userEmail: 'user2@example.com', newPlanName: 'enterprise', immediate: true }
])
```

### 3. REST API Endpoint

For programmatic access from external tools.

**Endpoint**: `POST /api/admin/subscription-update`

#### Setup

Add to your `.env.local`:
```bash
ADMIN_API_KEY=your_secure_admin_key_here
```

#### Usage Examples

```bash
# Update subscription via API
curl -X POST http://localhost:3000/api/admin/subscription-update \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "user@example.com",
    "newPlanName": "pro",
    "billingCycle": "monthly",
    "immediate": false,
    "reason": "Customer request",
    "adminKey": "your_secure_admin_key_here"
  }'

# List all subscriptions
curl "http://localhost:3000/api/admin/subscription-update?adminKey=your_secure_admin_key_here"
```

#### Response Format

```json
{
  "success": true,
  "message": "Successfully updated user@example.com from Starter to Pro",
  "oldSubscription": { ... },
  "newSubscription": { ... },
  "warnings": ["Optional warning messages"]
}
```

## Database Structure

The pricing system uses these key tables:

### `subscription_plans`
- Pre-defined plan configurations
- Contains pricing, limits, and features

### `user_subscriptions`
- User's active subscription records
- Links users to plans with billing periods

### `user_usage`
- Tracks daily usage by type
- Used for quota enforcement

### Views
- `user_current_subscription`: Current active subscription with plan details
- `user_current_month_usage`: Aggregated current month usage

## Common Operations

### Upgrading a User

When upgrading users:
1. Current subscription is marked for cancellation
2. New subscription is created immediately
3. User gets access to new tier features right away
4. Billing occurs according to new plan

### Downgrading a User

When downgrading:
1. System checks if current usage exceeds new limits
2. Warns if user will lose access to features
3. Recommendation to wait until next billing period
4. Can force immediate change if needed

### Handling Usage Overages

If a user has exceeded the new plan's limits:
- Script shows warnings
- Suggests waiting until next billing period
- Can force immediate change (may cause service disruption)
- Usage history is preserved

### Free Trials

Grant trials using:
```typescript
await subscriptionAdmin.grantFreeTrial('user@example.com', 'pro', 7)
```

## Security Considerations

1. **Service Role Key**: Required for admin operations, keep secure
2. **Admin API Key**: Use a strong, unique key for API access
3. **Audit Logs**: Consider adding audit logging for subscription changes
4. **Rate Limiting**: API endpoints should have rate limiting in production
5. **Authentication**: In production, replace simple API key with proper auth

## Monitoring

Key metrics to monitor:
- Failed subscription updates
- Usage vs plan limits
- Downgrades with overages
- Trial conversion rates

## Troubleshooting

### Common Issues

1. **"User not found"**: Check email spelling, verify user exists in auth.users
2. **"Plan not found"**: Ensure plan name is exactly 'starter', 'pro', or 'enterprise'
3. **"No active subscription"**: User may have canceled or expired subscription
4. **Usage overage warnings**: Review if downgrade is appropriate

### Recovery Procedures

If a subscription update fails:
1. Check user's current subscription status
2. Verify plan availability
3. Review usage patterns
4. Re-run with appropriate parameters

## Best Practices

1. **Always test** changes on staging environment first
2. **Backup** subscription data before bulk operations
3. **Communicate** with users before making changes
4. **Monitor** for errors after bulk updates
5. **Document** reasons for subscription changes