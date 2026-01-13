-- ============================================
-- Migration 002: Simplify to Two Tiers
-- Free (500 req/mo) → Pro ($14.99/mo unlimited)
-- Run with: psql $DATABASE_URL -f 002_simplify_tiers.sql
-- ============================================

-- 1. Update subscriptions table constraint
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_plan_tier_check;

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_plan_tier_check 
CHECK (plan_tier IN ('free', 'pro', 'legacy'));

-- 2. Update users table constraint
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_plan_tier_check;

ALTER TABLE users 
ADD CONSTRAINT users_plan_tier_check 
CHECK (plan_tier IN ('free', 'pro', 'legacy'));

-- 3. Add request tracking columns to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS requests_this_period INTEGER DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');

-- 4. Update existing users
-- Set all current users as legacy (grandfathered)
UPDATE users 
SET 
  plan_tier = 'legacy',
  is_legacy_user = TRUE,
  requests_this_period = 0,
  period_start = NOW(),
  period_end = NOW() + INTERVAL '30 days'
WHERE plan_tier IN ('free', 'starter', 'power') 
   OR plan_tier IS NULL;

-- 5. Create request tracking function
CREATE OR REPLACE FUNCTION increment_request_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE 
  v_count INTEGER;
  v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current period end
  SELECT period_end INTO v_period_end
  FROM users
  WHERE id = p_user_id;
  
  -- Reset if period has ended
  IF v_period_end < NOW() THEN
    UPDATE users
    SET 
      requests_this_period = 1,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '30 days',
      updated_at = NOW()
    WHERE id = p_user_id
    RETURNING requests_this_period INTO v_count;
  ELSE
    -- Increment count
    UPDATE users
    SET 
      requests_this_period = requests_this_period + 1,
      updated_at = NOW()
    WHERE id = p_user_id
    RETURNING requests_this_period INTO v_count;
  END IF;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Create request limit check function
CREATE OR REPLACE FUNCTION check_request_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_is_legacy BOOLEAN;
BEGIN
  SELECT plan_tier, requests_this_period, is_legacy_user
  INTO v_plan, v_count, v_is_legacy
  FROM users
  WHERE id = p_user_id;
  
  -- Legacy and Pro users have unlimited
  IF v_is_legacy OR v_plan = 'legacy' OR v_plan = 'pro' THEN
    RETURN TRUE;
  END IF;
  
  -- Free tier: 500 requests/month
  IF v_plan = 'free' THEN
    RETURN v_count < 500;
  END IF;
  
  -- Default: deny
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. Create index for period queries
CREATE INDEX IF NOT EXISTS idx_users_period_end ON users(period_end)
WHERE plan_tier = 'free';

-- 8. Update usage_logs to track request counting
ALTER TABLE usage_logs 
ADD COLUMN IF NOT EXISTS counted_toward_limit BOOLEAN DEFAULT TRUE;

-- 9. Create view for subscription analytics
CREATE OR REPLACE VIEW subscription_stats AS
SELECT 
  plan_tier,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE requests_this_period > 0) as active_users,
  AVG(requests_this_period) as avg_requests,
  MAX(requests_this_period) as max_requests,
  SUM(requests_this_period) as total_requests
FROM users
GROUP BY plan_tier;

-- 10. Grant permissions (if using RLS)
-- GRANT SELECT ON subscription_stats TO authenticated;

SELECT 'Migration 002 completed successfully!' AS status;

-- Verification queries:
SELECT 'User tiers:' as check;
SELECT plan_tier, COUNT(*) FROM users GROUP BY plan_tier;

SELECT 'Subscription constraints:' as check;
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%plan_tier%';
