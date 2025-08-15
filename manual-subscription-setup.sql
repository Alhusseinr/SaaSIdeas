-- Manual Subscription Setup for Testing
-- Run these commands in your Supabase SQL editor to give a user an active subscription

-- 1. First, find the user ID you want to update
-- Replace 'user@example.com' with the actual email
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- 2. Get the available subscription plans
SELECT id, name, display_name, price_monthly FROM subscription_plans;

-- 3. Create an active subscription for the user
-- Replace the UUIDs with actual values from steps 1 and 2
INSERT INTO user_subscriptions (
    user_id,
    plan_id, 
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    stripe_customer_id,
    stripe_subscription_id
) VALUES (
    'USER_ID_FROM_STEP_1',              -- Replace with actual user ID
    'PLAN_ID_FROM_STEP_2',              -- Replace with plan ID (starter/pro/enterprise)
    'active',                           -- Subscription status
    'monthly',                          -- or 'yearly'
    NOW(),                              -- Subscription starts now
    NOW() + INTERVAL '1 month',         -- Ends in 1 month (use '1 year' for yearly)
    false,                              -- Don't cancel at period end
    'cus_test_customer_id',             -- Mock Stripe customer ID (optional)
    'sub_test_subscription_id'          -- Mock Stripe subscription ID (optional)
);

-- 4. Verify the subscription was created
SELECT 
    us.*,
    sp.name as plan_name,
    sp.display_name,
    sp.price_monthly
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = 'USER_ID_FROM_STEP_1';

-- 5. Test that the user can validate ideas
SELECT can_user_validate_idea('USER_ID_FROM_STEP_1');

-- EXAMPLE: Complete workflow for a specific user
-- (Replace with your actual values)

-- Step 1: Find user
-- SELECT id, email FROM auth.users WHERE email = 'john@example.com';
-- Result: id = '123e4567-e89b-12d3-a456-426614174000'

-- Step 2: Get Pro plan ID  
-- SELECT id, name FROM subscription_plans WHERE name = 'pro';
-- Result: id = '456e7890-e89b-12d3-a456-426614174001'

-- Step 3: Create subscription
-- INSERT INTO user_subscriptions (
--     user_id,
--     plan_id,
--     status,
--     billing_cycle,
--     current_period_start,
--     current_period_end,
--     cancel_at_period_end
-- ) VALUES (
--     '123e4567-e89b-12d3-a456-426614174000',  -- John's user ID
--     '456e7890-e89b-12d3-a456-426614174001',  -- Pro plan ID
--     'active',
--     'monthly',
--     NOW(),
--     NOW() + INTERVAL '1 month',
--     false
-- );

-- QUICK TEST SCRIPT
-- If you know the email and want Pro plan:
/*
DO $$
DECLARE
    user_uuid UUID;
    plan_uuid UUID;
BEGIN
    -- Get user ID by email
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'your-email@example.com';
    
    -- Get Pro plan ID
    SELECT id INTO plan_uuid FROM subscription_plans WHERE name = 'pro';
    
    -- Create subscription
    INSERT INTO user_subscriptions (
        user_id,
        plan_id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        cancel_at_period_end
    ) VALUES (
        user_uuid,
        plan_uuid,
        'active',
        'monthly',
        NOW(),
        NOW() + INTERVAL '1 month',
        false
    );
    
    RAISE NOTICE 'Subscription created for user: %', user_uuid;
END $$;
*/