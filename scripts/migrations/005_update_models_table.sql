-- ============================================
-- Migration 005: Update Models Table to Latest Provider Models
-- AISheeter - February 2026
-- Run with: psql $DATABASE_URL -f 005_update_models_table.sql
-- ============================================
--
-- Removes deprecated models and ensures the models table
-- only contains currently available, supported models.
--
-- Sources (verified Feb 2026):
-- OpenAI:    https://developers.openai.com/api/docs/models
-- Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
-- Google:    https://ai.google.dev/gemini-api/docs/models
-- Groq:      https://console.groq.com/docs/models
-- ============================================

-- Step 1: Add unique constraint on name if it doesn't exist
-- (needed for future upserts and data integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'models_name_unique'
  ) THEN
    ALTER TABLE models ADD CONSTRAINT models_name_unique UNIQUE (name);
  END IF;
END $$;

-- ============================================
-- Step 2: Remove deprecated models
-- ============================================

-- Deprecated OpenAI models
DELETE FROM models WHERE llm = 'CHATGPT' AND name IN (
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini'
);

-- Deprecated Google models
DELETE FROM models WHERE llm = 'GEMINI' AND name IN (
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-thinking',
  'gemini-pro'
);

-- Deprecated Anthropic models
DELETE FROM models WHERE llm = 'CLAUDE' AND name IN (
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-instant-1.2'
);

-- Deprecated Groq models
DELETE FROM models WHERE llm = 'GROQ' AND name IN (
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma-7b-it',
  'gemma2-9b-it'
);

-- ============================================
-- Step 3: Upsert current models
-- Now safe to use ON CONFLICT after adding the unique constraint
-- ============================================

-- ----- OPENAI (CHATGPT) -----

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gpt-5-mini', 'GPT-5 Mini', 'CHATGPT', 0.00000025)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gpt-5', 'GPT-5', 'CHATGPT', 0.00000125)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gpt-5.1', 'GPT-5.1', 'CHATGPT', 0.000002)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gpt-5.2', 'GPT-5.2', 'CHATGPT', 0.000003)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('o3-mini', 'o3 Mini', 'CHATGPT', 0.0000011)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('o3', 'o3 Reasoning', 'CHATGPT', 0.000002)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('o4-mini', 'o4 Mini', 'CHATGPT', 0.0000011)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

-- ----- ANTHROPIC (CLAUDE) -----

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 'CLAUDE', 0.000001)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('claude-sonnet-4-5-20250514', 'Claude Sonnet 4.5', 'CLAUDE', 0.000003)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('claude-opus-4-20250514', 'Claude Opus 4', 'CLAUDE', 0.000005)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('claude-sonnet-4-20250514', 'Claude Sonnet 4', 'CLAUDE', 0.000003)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

-- ----- GOOGLE (GEMINI) -----

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gemini-2.5-flash', 'Gemini 2.5 Flash', 'GEMINI', 0.00000015)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gemini-2.5-pro', 'Gemini 2.5 Pro', 'GEMINI', 0.00000125)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 'GEMINI', 0.0000001)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

-- ----- GROQ -----

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('llama-3.3-70b-versatile', 'Llama 3.3 70B', 'GROQ', 0.00000059)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('meta-llama/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick', 'GROQ', 0.0000002)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

INSERT INTO models (name, display_name, llm, credit_price_per_token)
VALUES ('meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'GROQ', 0.00000011)
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, credit_price_per_token = EXCLUDED.credit_price_per_token;

-- ============================================
-- Verification: Show final state
-- ============================================

SELECT llm, name, display_name, credit_price_per_token 
FROM models 
ORDER BY llm, display_name;

SELECT 'Migration 005 completed: Models table updated to latest provider models (Feb 2026)' AS status;
