-- ============================================
-- Migration 006: Remove managed credits from legacy users
-- 
-- Legacy users are grandfathered free users with unlimited BYOK access.
-- They were never paying customers and should not receive managed credits.
-- They use their own API keys exclusively.
--
-- Run with: psql $DATABASE_URL -f 006_legacy_no_managed_credits.sql
-- ============================================

-- 1. Set cap to 0 for all legacy users (removes managed credit allocation)
UPDATE users 
SET managed_credits_cap_usd = 0,
    managed_credits_used_usd = 0,
    updated_at = NOW()
WHERE plan_tier = 'legacy';

-- 2. Verify the change
SELECT plan_tier, COUNT(*) as user_count, 
       AVG(managed_credits_cap_usd) as avg_cap,
       SUM(managed_credits_cap_usd) as total_cap
FROM users 
GROUP BY plan_tier
ORDER BY plan_tier;

SELECT 'Migration 006: Legacy users managed credits removed - completed!' AS status;
