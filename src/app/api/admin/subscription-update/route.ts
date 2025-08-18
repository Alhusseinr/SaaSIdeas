import { NextRequest, NextResponse } from 'next/server'
import { subscriptionAdmin } from '@/lib/admin/subscriptionAdmin'

/**
 * Admin API endpoint to update user subscription tiers
 * 
 * POST /api/admin/subscription-update
 * 
 * Body:
 * {
 *   "userEmail": "user@example.com",
 *   "newPlanName": "pro",
 *   "billingCycle": "monthly",
 *   "immediate": false,
 *   "reason": "Customer request",
 *   "adminKey": "your-admin-key"
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, newPlanName, billingCycle, immediate, reason, adminKey } = body
    
    // Simple admin key check (in production, use proper authentication)
    const expectedAdminKey = process.env.ADMIN_API_KEY
    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Validate required fields
    if (!userEmail || !newPlanName) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, newPlanName' },
        { status: 400 }
      )
    }
    
    // Validate plan name
    const validPlans = ['starter', 'pro', 'enterprise']
    if (!validPlans.includes(newPlanName)) {
      return NextResponse.json(
        { error: `Invalid plan name. Valid options: ${validPlans.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Update subscription
    const result = await subscriptionAdmin.updateSubscriptionTier({
      userEmail,
      newPlanName,
      billingCycle: billingCycle || 'monthly',
      immediate: immediate || false,
      reason
    })
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }
    
  } catch (error: any) {
    console.error('Admin subscription update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get all subscriptions for admin overview
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('adminKey')
    
    // Simple admin key check
    const expectedAdminKey = process.env.ADMIN_API_KEY
    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const subscriptions = await subscriptionAdmin.getAllSubscriptions()
    return NextResponse.json({ subscriptions })
    
  } catch (error: any) {
    console.error('Admin subscription list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}