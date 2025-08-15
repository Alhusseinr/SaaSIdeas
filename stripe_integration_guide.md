# Complete Stripe Integration Guide

## Overview
This guide shows how to integrate Stripe with the existing pricing system architecture. The current implementation follows Stripe best practices and is ready for production integration.

## 1. Install Stripe Dependencies

```bash
npm install stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

## 2. Environment Variables

Add to your `.env.local`:

```env
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Your domain for redirects
NEXT_PUBLIC_DOMAIN=http://localhost:3000
```

## 3. Stripe Configuration

Create `src/lib/stripe.ts`:

```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Client-side Stripe
import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)
```

## 4. Create Stripe Products and Prices

### Option A: Stripe Dashboard
1. Go to Stripe Dashboard → Products
2. Create products for each plan:
   - Starter Plan ($49/month, $490/year)
   - Pro Plan ($99/month, $990/year)  
   - Enterprise Plan ($199/month, $1990/year)

### Option B: Programmatically (Recommended)

Create `scripts/setup-stripe-products.js`:

```javascript
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function setupProducts() {
  // Starter Plan
  const starterProduct = await stripe.products.create({
    name: 'Starter Plan',
    description: 'Perfect for individual entrepreneurs and side projects',
  });

  const starterMonthly = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 4900, // $49.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan_name: 'starter' }
  });

  const starterYearly = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 49000, // $490.00 (2 months free)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan_name: 'starter' }
  });

  // Pro Plan
  const proProduct = await stripe.products.create({
    name: 'Pro Plan',
    description: 'Ideal for serious builders and small teams',
  });

  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 9900, // $99.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan_name: 'pro' }
  });

  const proYearly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 99000, // $990.00
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan_name: 'pro' }
  });

  // Enterprise Plan
  const enterpriseProduct = await stripe.products.create({
    name: 'Enterprise Plan',
    description: 'For agencies, VCs, and large teams',
  });

  const enterpriseMonthly = await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: 19900, // $199.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan_name: 'enterprise' }
  });

  const enterpriseYearly = await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: 199000, // $1990.00
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan_name: 'enterprise' }
  });

  console.log('Products and prices created successfully!');
  console.log('Update your database with these Stripe price IDs:');
  console.log('Starter Monthly:', starterMonthly.id);
  console.log('Starter Yearly:', starterYearly.id);
  console.log('Pro Monthly:', proMonthly.id);
  console.log('Pro Yearly:', proYearly.id);
  console.log('Enterprise Monthly:', enterpriseMonthly.id);
  console.log('Enterprise Yearly:', enterpriseYearly.id);
}

setupProducts().catch(console.error);
```

Run: `node scripts/setup-stripe-products.js`

## 5. Update Database Schema

Add Stripe price IDs to your subscription_plans table:

```sql
-- Add Stripe price ID columns
ALTER TABLE subscription_plans 
ADD COLUMN stripe_price_id_monthly VARCHAR(255),
ADD COLUMN stripe_price_id_yearly VARCHAR(255);

-- Update with your Stripe price IDs (from step 4)
UPDATE subscription_plans SET 
  stripe_price_id_monthly = 'price_1234567890abcdef',
  stripe_price_id_yearly = 'price_abcdef1234567890'
WHERE name = 'starter';

-- Repeat for pro and enterprise plans
```

## 6. Create Checkout API Route

Create `src/app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'
import { getUser } from '@/lib/auth' // Your auth helper

export async function POST(req: NextRequest) {
  try {
    const { planId, billingCycle } = await req.json()
    
    // Get authenticated user
    const user = await getUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id
        }
      })
      customerId = customer.id
      
      // Update user with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get the correct price ID
    const priceId = billingCycle === 'yearly' 
      ? plan.stripe_price_id_yearly 
      : plan.stripe_price_id_monthly

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/dashboard?tab=subscription&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/dashboard?tab=pricing&canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle
      }
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
```

## 7. Update PricingPlans Component

Update the `handleSubscribe` function in `PricingPlans.tsx`:

```typescript
import { stripePromise } from '@/lib/stripe'

const handleSubscribe = async (planId: string, planName: string) => {
  setIsSubscribing(planId)
  
  try {
    // Create checkout session
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        billingCycle
      }),
    })

    const { sessionId, error } = await response.json()

    if (error) {
      throw new Error(error)
    }

    // Redirect to Stripe Checkout
    const stripe = await stripePromise
    const { error: stripeError } = await stripe!.redirectToCheckout({
      sessionId,
    })

    if (stripeError) {
      throw stripeError
    }
  } catch (error) {
    console.error('Subscription error:', error)
    alert('Subscription failed. Please try again.')
  } finally {
    setIsSubscribing(null)
  }
}
```

## 8. Create Webhook Endpoint

Create `src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { PricingService } from '@/lib/pricing'
import { headers } from 'next/headers'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
        
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { user_id, plan_id, billing_cycle } = session.metadata!
  
  // Create subscription in database
  await PricingService.createSubscription(
    user_id,
    plan_id,
    billing_cycle as 'monthly' | 'yearly',
    session.customer as string,
    session.subscription as string
  )
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Update subscription status in database
  const { data: userSub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (userSub) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('id', userSub.id)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Mark subscription as canceled
  await supabase
    .from('user_subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Record successful payment
  const { data: userSub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', invoice.subscription)
    .single()

  if (userSub) {
    await supabase
      .from('billing_history')
      .insert({
        user_id: userSub.user_id,
        subscription_id: userSub.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent as string,
        billing_period_start: new Date(invoice.period_start * 1000).toISOString(),
        billing_period_end: new Date(invoice.period_end * 1000).toISOString(),
        paid_at: new Date().toISOString()
      })
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payment
  await supabase
    .from('user_subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', invoice.subscription)
}
```

## 9. Webhook Configuration

1. In Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://your-domain.com/api/webhooks/stripe`
3. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## 10. Customer Portal (Optional)

Create `src/app/api/customer-portal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: 'No customer found' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_DOMAIN}/dashboard?tab=subscription`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Customer portal error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
```

## 11. Testing

### Test Mode:
1. Use Stripe test keys
2. Test card: `4242 4242 4242 4242`
3. Test webhooks with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Production:
1. Replace test keys with live keys
2. Update webhook URL to production domain
3. Test with real payment methods

## 12. Security Best Practices

✅ **Already Implemented:**
- Webhook signature verification
- Server-side subscription creation
- RLS policies protecting user data
- Metadata validation

✅ **Additional Recommendations:**
- Rate limiting on API routes
- Input validation and sanitization
- Proper error handling without exposing internals
- Monitoring and alerting for failed payments

This integration follows Stripe's best practices and maintains the security and reliability of your existing pricing system!