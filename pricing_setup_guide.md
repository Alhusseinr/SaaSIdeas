# Pricing System Implementation Guide

## Overview
This comprehensive pricing system implementation includes:
- Database schema for subscriptions and usage tracking
- TypeScript types and service layer
- React components for subscription management
- Usage enforcement in the IdeaValidator
- Dashboard integration with pricing tabs

## 1. Database Setup

### Run the Migration Script
Execute the `pricing_system_migration.sql` file in your Supabase SQL editor:

```sql
-- Copy and paste the entire content of pricing_system_migration.sql
-- This will create all tables, functions, policies, and seed data
```

### Verify Database Setup
Check that these tables were created:
- `subscription_plans`
- `user_subscriptions`
- `user_usage`
- `billing_history`

## 2. Environment Variables

Add these to your `.env.local` file:

```env
# Existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Payment processor integration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Show/hide admin features
NEXT_PUBLIC_SHOW_EDGE_FUNCTIONS=false
```

## 3. Files Added/Modified

### New Files Created:
1. **Database Schema**: `pricing_system_migration.sql`
2. **Types**: `src/types/pricing.ts`
3. **Service Layer**: `src/lib/pricing.ts`
4. **Context**: `src/contexts/PricingContext.tsx`
5. **Components**:
   - `src/components/SubscriptionStatus.tsx`
   - `src/components/PricingPlans.tsx`
6. **Documentation**: `pricing_setup_guide.md`

### Modified Files:
1. **Main App**: `src/app/page.tsx` - Added PricingProvider
2. **Dashboard**: `src/components/Dashboard.tsx` - Added subscription tabs
3. **IdeaValidator**: `src/components/IdeaValidator.tsx` - Added usage tracking
4. **Landing Page**: Already updated with new pricing ($49, $99, $199)

## 4. Features Implemented

### ✅ Complete Features:
- **Database Schema**: All tables, indexes, RLS policies
- **Subscription Plans**: Starter ($49), Pro ($99), Enterprise ($199)
- **Usage Tracking**: Automatic tracking of idea validations
- **Usage Limits**: Enforcement in IdeaValidator component
- **Dashboard Integration**: Subscription and Pricing tabs
- **Real-time Updates**: Context refreshes usage data
- **Visual Indicators**: Usage warnings and limit notifications

### 🔄 Partially Implemented:
- **Payment Processing**: Stripe integration scaffold (needs completion)
- **Billing History**: Database structure ready (needs UI completion)
- **Team Management**: Database ready (needs UI)

### 📋 Ready for Integration:
- **Stripe Webhooks**: Database ready for subscription updates
- **Email Notifications**: Usage alerts and billing notices
- **Admin Dashboard**: Subscription management and analytics

## 5. How It Works

### User Flow:
1. **New User**: Lands on pricing page, can start trial
2. **Trial User**: Gets 7-day trial with Pro features
3. **Validation Limits**: System tracks and enforces monthly limits
4. **Upgrade Path**: Clear upgrade prompts when approaching limits
5. **Billing**: Automated tracking ready for payment processor

### Technical Flow:
1. **Authentication**: User logs in
2. **Subscription Check**: System loads current subscription
3. **Usage Validation**: Before each validation, check quota
4. **Usage Recording**: After successful validation, record usage
5. **Limit Enforcement**: Block validation if quota exceeded

## 6. Database Functions Available

### User-facing Functions:
- `can_user_validate_idea(user_id)` - Check if user can validate
- `record_user_usage(user_id, type, count, metadata)` - Track usage
- `user_current_subscription` - View for current subscription
- `user_current_month_usage` - View for current month usage

### Admin Functions (via service role):
- Create/update subscriptions
- Manage billing history
- Generate usage reports

## 7. React Context Usage

```tsx
// In any component
import { usePricingActions } from '@/contexts/PricingContext'

function MyComponent() {
  const {
    currentSubscription,
    canValidateIdea,
    getRemainingValidations,
    recordUsage,
    getCurrentPlan
  } = usePricingActions()

  // Use the data and functions
}
```

## 8. API Integration Points

### Ready for Payment Processor:
```typescript
// In PricingPlans component - handleSubscribe function
// Integrate with Stripe, Paddle, or other payment processor

const handleSubscribe = async (planId: string, billingCycle: string) => {
  // 1. Create checkout session
  const session = await stripe.checkout.sessions.create({...})
  
  // 2. Redirect to checkout
  window.location.href = session.url
  
  // 3. Handle success webhook (separate endpoint)
  // 4. Update database via PricingService.createSubscription()
}
```

### Webhook Endpoints Needed:
- `/api/webhooks/stripe` - Handle subscription events
- `/api/webhooks/billing` - Handle payment events

## 9. Security Considerations

### Row Level Security (RLS):
- ✅ Users can only access their own data
- ✅ Service role can manage all data
- ✅ Public can read active plans only

### Usage Validation:
- ✅ Server-side validation before API calls
- ✅ Client-side UI updates for better UX
- ✅ Database functions prevent usage tampering

## 10. Testing the Implementation

### Manual Testing Steps:

1. **Database Setup**:
   ```sql
   -- Check if tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name LIKE '%subscription%';
   ```

2. **Create Test Subscription**:
   ```sql
   -- Insert test subscription for your user
   INSERT INTO user_subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
   SELECT 
     'your-user-id',
     id,
     'active',
     'monthly',
     NOW(),
     NOW() + INTERVAL '1 month'
   FROM subscription_plans WHERE name = 'pro';
   ```

3. **Test Usage Tracking**:
   - Go to Idea Validator tab
   - Submit a validation
   - Check Subscription tab for updated usage

4. **Test Limits**:
   - Manually set high usage in database
   - Try to validate idea (should be blocked)

## 11. Next Steps for Full Production

### Payment Integration:
1. Set up Stripe/payment processor account
2. Implement checkout flows
3. Add webhook endpoints
4. Test payment flows

### Additional Features:
1. Email notifications for usage alerts
2. Admin dashboard for subscription management
3. Team management and collaboration features
4. Advanced analytics and reporting

### Monitoring:
1. Set up error tracking
2. Add usage analytics
3. Monitor subscription metrics
4. Track conversion rates

## 12. Troubleshooting

### Common Issues:

1. **RLS Policies**: If users can't access data, check policies
2. **Context Not Loading**: Ensure PricingProvider wraps components
3. **Usage Not Recording**: Check function permissions
4. **Validation Blocked**: Verify subscription status and usage limits

### Debug Queries:
```sql
-- Check user's subscription
SELECT * FROM user_current_subscription WHERE user_id = 'user-id';

-- Check usage
SELECT * FROM user_current_month_usage WHERE user_id = 'user-id';

-- Check if user can validate
SELECT can_user_validate_idea('user-id');
```

This implementation provides a robust foundation for a SaaS pricing system with room for future enhancements and payment processor integration.