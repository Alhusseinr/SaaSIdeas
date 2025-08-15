-- Enhanced AI Analysis Framework Schema Extensions
-- Add these columns to your existing saas_ideas table

-- Enhanced Analysis Fields
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS competitive_landscape JSONB;
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS founder_market_fit_score INTEGER CHECK (founder_market_fit_score >= 0 AND founder_market_fit_score <= 100);
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS revenue_projection JSONB;
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS technical_feasibility_score INTEGER CHECK (technical_feasibility_score >= 0 AND technical_feasibility_score <= 100);
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS go_to_market_difficulty INTEGER CHECK (go_to_market_difficulty >= 0 AND go_to_market_difficulty <= 100);
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS market_size_estimate BIGINT;
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS development_timeline_months INTEGER;
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS required_skills JSONB;
ALTER TABLE saas_ideas ADD COLUMN IF NOT EXISTS investment_required INTEGER;

-- Problem of the Day feature
CREATE TABLE IF NOT EXISTS daily_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID REFERENCES saas_ideas(id),
    featured_date DATE UNIQUE NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trending problems tracking
CREATE TABLE IF NOT EXISTS problem_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID REFERENCES saas_ideas(id),
    date DATE NOT NULL,
    mention_count INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3,2),
    trend_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(idea_id, date)
);

-- User engagement tracking
CREATE TABLE IF NOT EXISTS user_idea_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    idea_id UUID REFERENCES saas_ideas(id),
    action_type VARCHAR(50) NOT NULL, -- 'view', 'bookmark', 'download', 'share'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_problems_date ON daily_problems(featured_date DESC);
CREATE INDEX IF NOT EXISTS idx_problem_trends_date ON problem_trends(date DESC);
CREATE INDEX IF NOT EXISTS idx_problem_trends_score ON problem_trends(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_idea_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_idea ON user_idea_interactions(idea_id);

-- Sample data for competitive landscape structure
-- JSONB structure example:
-- {
--   "direct_competitors": ["Competitor1", "Competitor2"],
--   "indirect_competitors": ["Alt1", "Alt2"],
--   "market_gap_score": 85,
--   "differentiation_opportunities": ["Feature A", "Feature B"],
--   "competitive_advantage": "First mover in X market"
-- }

-- Sample data for revenue projection structure
-- {
--   "monthly_recurring_revenue": {
--     "month_6": 5000,
--     "month_12": 25000,
--     "month_24": 100000
--   },
--   "pricing_model": "subscription",
--   "target_customers": 1000,
--   "average_revenue_per_user": 50,
--   "churn_rate": 5,
--   "customer_acquisition_cost": 100,
--   "lifetime_value": 1000
-- }

-- Function to get trending problems
CREATE OR REPLACE FUNCTION get_trending_problems(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    idea_id UUID,
    idea_name TEXT,
    trend_score INTEGER,
    mention_count_total INTEGER,
    sentiment_avg DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.name,
        COALESCE(AVG(pt.trend_score)::INTEGER, 0) as trend_score,
        COALESCE(SUM(pt.mention_count)::INTEGER, 0) as mention_count_total,
        COALESCE(AVG(pt.sentiment_score), 0) as sentiment_avg
    FROM saas_ideas si
    LEFT JOIN problem_trends pt ON si.id = pt.idea_id 
        AND pt.date >= (CURRENT_DATE - INTERVAL '%s days' % days_back)
    WHERE si.created_at >= (NOW() - INTERVAL '%s days' % days_back)
    GROUP BY si.id, si.name
    ORDER BY trend_score DESC, mention_count_total DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get problem of the day
CREATE OR REPLACE FUNCTION get_problem_of_the_day(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    id UUID,
    name TEXT,
    one_liner TEXT,
    score INTEGER,
    engagement_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.name,
        si.one_liner,
        si.score,
        dp.engagement_score
    FROM daily_problems dp
    JOIN saas_ideas si ON dp.idea_id = si.id
    WHERE dp.featured_date = target_date
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;