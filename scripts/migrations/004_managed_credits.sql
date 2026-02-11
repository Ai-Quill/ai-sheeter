-- ============================================
-- Migration 004: Managed AI Credits
-- Adds managed credit tracking for free + paid users
-- Free: ~$0.015 cap (50 queries on mini models)
-- Pro: $4.99 cap (mini + mid-tier models)
-- Legacy: $0 cap (BYOK only, no managed credits)
-- Run with: psql $DATABASE_URL -f 004_managed_credits.sql
-- ============================================

-- 1. Add managed credit columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_credits_used_usd DECIMAL(10,6) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_credits_cap_usd DECIMAL(10,6) DEFAULT 0.015;
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_credits_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');

-- 2. Set caps based on current plan tier
-- Legacy users are grandfathered free users with unlimited BYOK — no managed credits
UPDATE users SET managed_credits_cap_usd = 0.015 WHERE plan_tier = 'free';
UPDATE users SET managed_credits_cap_usd = 4.99 WHERE plan_tier = 'pro';
UPDATE users SET managed_credits_cap_usd = 0 WHERE plan_tier = 'legacy';

-- 3. Add managed tracking to usage_logs
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT FALSE;
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS managed_cost_usd DECIMAL(10,6) DEFAULT 0;

-- 4. Function: Debit managed credits atomically
CREATE OR REPLACE FUNCTION debit_managed_credits(p_user_id UUID, p_cost_usd DECIMAL)
RETURNS DECIMAL AS $$
DECLARE 
  v_new_used DECIMAL;
  v_cap DECIMAL;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if period needs reset first
  SELECT managed_credits_reset_at, managed_credits_cap_usd 
  INTO v_reset_at, v_cap
  FROM users WHERE id = p_user_id;
  
  IF v_reset_at < NOW() THEN
    -- Reset credits for new period
    UPDATE users
    SET managed_credits_used_usd = p_cost_usd,
        managed_credits_reset_at = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING managed_credits_used_usd INTO v_new_used;
  ELSE
    -- Normal debit
    UPDATE users
    SET managed_credits_used_usd = managed_credits_used_usd + p_cost_usd,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING managed_credits_used_usd INTO v_new_used;
  END IF;
  
  RETURN v_new_used;
END;
$$ LANGUAGE plpgsql;

-- 5. Function: Check managed credit balance
CREATE OR REPLACE FUNCTION check_managed_credits(p_user_id UUID)
RETURNS TABLE(
  can_use BOOLEAN,
  used_usd DECIMAL,
  cap_usd DECIMAL,
  remaining_usd DECIMAL
) AS $$
DECLARE
  v_used DECIMAL;
  v_cap DECIMAL;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT managed_credits_used_usd, managed_credits_cap_usd, managed_credits_reset_at
  INTO v_used, v_cap, v_reset_at
  FROM users WHERE id = p_user_id;
  
  -- Auto-reset if period expired
  IF v_reset_at < NOW() THEN
    v_used := 0;
    PERFORM reset_managed_credits(p_user_id);
  END IF;
  
  can_use := v_used < v_cap;
  used_usd := v_used;
  cap_usd := v_cap;
  remaining_usd := GREATEST(0, v_cap - v_used);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. Function: Reset managed credits (used by webhook on renewal)
CREATE OR REPLACE FUNCTION reset_managed_credits(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET managed_credits_used_usd = 0,
      managed_credits_reset_at = NOW() + INTERVAL '30 days',
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Index for managed credit reset queries
CREATE INDEX IF NOT EXISTS idx_users_managed_reset ON users(managed_credits_reset_at)
WHERE managed_credits_cap_usd > 0;

SELECT 'Migration 004: Managed credits - completed successfully!' AS status;

-- Verification
SELECT plan_tier, COUNT(*), AVG(managed_credits_cap_usd) as avg_cap
FROM users 
GROUP BY plan_tier;
