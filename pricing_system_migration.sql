-- Pricing System Migration Script for Reddit SaaS Ideas Platform
-- Run these commands in your Supabase SQL editor

-- 1. Create subscription plans table
CREATE TABLE subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL, -- Price in cents
    price_yearly INTEGER, -- Price in cents for yearly billing
    validations_per_month INTEGER NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user subscriptions table
CREATE TABLE user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, status) -- Only one active subscription per user
);

-- 3. Create usage tracking table
CREATE TABLE user_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL, -- 'idea_validation', 'api_call', etc.
    usage_count INTEGER DEFAULT 1,
    usage_date DATE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, usage_type, usage_date) -- One record per user per type per day
);

-- 4. Create billing history table
CREATE TABLE billing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id),
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 5. Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, validations_per_month, features) VALUES
('starter', 'Starter', 'Perfect for individual entrepreneurs and side projects', 4900, 49000, 25, 
 '["AI-powered market analysis", "Reddit data integration", "Email support", "Implementation prompts", "Basic competitive analysis", "Export to CSV"]'::jsonb),
 
('pro', 'Pro', 'Ideal for serious builders and small teams', 9900, 99000, 100,
 '["Advanced AI analysis with GPT-4", "Reddit + Twitter integration", "Priority support & live chat", "Custom implementation plans", "Advanced competitive intelligence", "Revenue modeling & pricing analysis", "API access", "Advanced export capabilities", "Team collaboration (up to 3 users)"]'::jsonb),
 
('enterprise', 'Enterprise', 'For agencies, VCs, and large teams', 19900, 199000, -1,
 '["Unlimited idea validations", "Multi-platform data integration", "White-label options", "Dedicated account manager", "Custom AI training", "Advanced analytics dashboard", "Team collaboration (unlimited users)", "Priority feature requests", "Custom integrations", "SLA guarantee", "On-premise deployment option"]'::jsonb);

-- 6. Create indexes for performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_usage_user_id_date ON user_usage(user_id, usage_date);
CREATE INDEX idx_user_usage_subscription_id ON user_usage(subscription_id);
CREATE INDEX idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX idx_billing_history_subscription_id ON billing_history(subscription_id);

-- 7. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Add updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Row Level Security (RLS) policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read subscription plans
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Users can only access their own subscription data
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage" ON user_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own billing history" ON billing_history
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all data (for backend operations)
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage" ON user_usage
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage billing" ON billing_history
    FOR ALL USING (auth.role() = 'service_role');

-- 10. Create helpful views
CREATE VIEW user_current_subscription AS
SELECT 
    us.*,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    sp.validations_per_month,
    sp.features,
    sp.price_monthly,
    sp.price_yearly
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active';

-- View for current month usage
CREATE VIEW user_current_month_usage AS
SELECT 
    user_id,
    subscription_id,
    usage_type,
    SUM(usage_count) as total_usage,
    DATE_TRUNC('month', CURRENT_DATE) as usage_month
FROM user_usage 
WHERE usage_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY user_id, subscription_id, usage_type;

-- 11. Function to check if user can perform an action
CREATE OR REPLACE FUNCTION can_user_validate_idea(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_sub RECORD;
    current_usage INTEGER;
BEGIN
    -- Get user's current subscription
    SELECT * INTO user_sub FROM user_current_subscription WHERE user_id = user_uuid;
    
    -- If no subscription, return false
    IF user_sub IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- If unlimited validations (enterprise), return true
    IF user_sub.validations_per_month = -1 THEN
        RETURN TRUE;
    END IF;
    
    -- Check current month usage
    SELECT COALESCE(total_usage, 0) INTO current_usage 
    FROM user_current_month_usage 
    WHERE user_id = user_uuid AND usage_type = 'idea_validation';
    
    -- Return true if under limit
    RETURN current_usage < user_sub.validations_per_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to record usage
CREATE OR REPLACE FUNCTION record_user_usage(
    user_uuid UUID,
    usage_type_param VARCHAR(50),
    usage_count_param INTEGER DEFAULT 1,
    metadata_param JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
DECLARE
    user_sub_id UUID;
BEGIN
    -- Get user's current subscription ID
    SELECT id INTO user_sub_id FROM user_subscriptions 
    WHERE user_id = user_uuid AND status = 'active';
    
    -- If no active subscription, return false
    IF user_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update usage record
    INSERT INTO user_usage (user_id, subscription_id, usage_type, usage_count, usage_date, metadata)
    VALUES (user_uuid, user_sub_id, usage_type_param, usage_count_param, CURRENT_DATE, metadata_param)
    ON CONFLICT (user_id, usage_type, usage_date)
    DO UPDATE SET 
        usage_count = user_usage.usage_count + usage_count_param,
        metadata = metadata_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON subscription_plans TO anon, authenticated;
GRANT SELECT ON user_current_subscription TO authenticated;
GRANT SELECT ON user_current_month_usage TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_validate_idea(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_user_usage(UUID, VARCHAR, INTEGER, JSONB) TO authenticated;

-- 13. Add user profile enhancements (optional)
-- Only run this if you have a profiles table, otherwise skip this section
DO $$ 
BEGIN
    -- Check if profiles table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- Add columns if they don't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
            ALTER TABLE profiles ADD COLUMN stripe_customer_id VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_ends_at') THEN
            ALTER TABLE profiles ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
            ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
        END IF;
        
        RAISE NOTICE 'Profile table columns added successfully';
    ELSE
        RAISE NOTICE 'Profiles table does not exist, skipping profile enhancements';
    END IF;
END $$;