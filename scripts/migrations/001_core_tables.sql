-- ============================================
-- Migration 001: Core Tables for Monetization
-- AISheeter v2.0.0
-- Run with: psql $DATABASE_URL -f 001_core_tables.sql
-- ============================================

-- 1. Extend users table for billing
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free' 
  CHECK (plan_tier IN ('free', 'legacy', 'starter', 'pro', 'power'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_legacy_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Mark existing users as legacy (they get grandfather privileges)
UPDATE users SET is_legacy_user = TRUE, plan_tier = 'legacy' 
WHERE plan_tier IS NULL OR plan_tier = 'free';

-- 2. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'pro', 'power')),
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- 3. Jobs table (async processing)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0,
  
  -- Config: { prompt, model, specificModel, encryptedApiKey, taskType }
  config JSONB NOT NULL,
  input_data JSONB NOT NULL,  -- Array of inputs
  total_rows INTEGER NOT NULL,
  
  -- Progress
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  processed_rows INTEGER DEFAULT 0,
  
  -- Results: [{ index, input, output, tokens, error? }]
  results JSONB DEFAULT '[]'::jsonb,
  
  -- Costs
  credits_estimated INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);

-- 4. Enhanced usage logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  model TEXT NOT NULL,
  specific_model TEXT,
  prompt_hash TEXT,
  
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  
  credits_charged INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  
  source TEXT DEFAULT 'formula' CHECK (source IN ('formula', 'bulk_job', 'api')),
  is_byok BOOLEAN DEFAULT TRUE,
  is_cached BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_created ON usage_logs(user_id, created_at DESC);

-- 5. Response cache
CREATE TABLE IF NOT EXISTS response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,  -- SHA256(model + prompt)
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_hit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON response_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON response_cache(expires_at);

-- ============================================
-- Helper Functions
-- ============================================

-- Check if user has sufficient credits
CREATE OR REPLACE FUNCTION check_credits(p_user_id UUID, p_required INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance INTEGER;
  v_plan TEXT;
  v_is_legacy BOOLEAN;
BEGIN
  SELECT credits_balance, plan_tier, is_legacy_user 
  INTO v_balance, v_plan, v_is_legacy
  FROM users WHERE id = p_user_id;
  
  -- Legacy users with BYOK don't need credits
  IF v_is_legacy OR v_plan = 'legacy' THEN RETURN TRUE; END IF;
  
  RETURN COALESCE(v_balance, 0) >= p_required;
END;
$$ LANGUAGE plpgsql;

-- Deduct credits atomically
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE v_new_balance INTEGER;
BEGIN
  UPDATE users 
  SET credits_balance = GREATEST(0, credits_balance - p_amount),
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING credits_balance INTO v_new_balance;
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Get next queued job (with locking for workers)
CREATE OR REPLACE FUNCTION get_next_job()
RETURNS UUID AS $$
DECLARE v_job_id UUID;
BEGIN
  UPDATE jobs
  SET status = 'processing', started_at = NOW()
  WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Increment cache hit count
CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE response_cache 
  SET hit_count = hit_count + 1, last_hit_at = NOW()
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (enable later)
-- ============================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY users_self ON users FOR ALL USING (auth.uid() = id);
-- CREATE POLICY subs_self ON subscriptions FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY jobs_self ON jobs FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY usage_self ON usage_logs FOR ALL USING (user_id = auth.uid());

SELECT 'Migration 001 completed successfully!' AS status;
