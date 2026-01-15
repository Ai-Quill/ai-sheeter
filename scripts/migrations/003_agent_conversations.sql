-- ============================================
-- Migration 003: Agent Conversations
-- Smart Agent Feature: Conversation Persistence
-- ============================================
-- 
-- Purpose: Store agent conversation state so users don't lose context
-- Pain point: "Users often lose context with Gemini"
-- 
-- Run this in Supabase SQL Editor

-- Agent Conversations Table
-- Stores conversation history per user per spreadsheet
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and spreadsheet identification
  user_id TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  sheet_name TEXT,
  
  -- Conversation state
  messages JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ role: 'user'|'agent', content: string, timestamp: ISO, metadata?: {} }]
  
  -- Context snapshot (what the agent knows about the data)
  context JSONB DEFAULT '{}'::jsonb,
  -- Format: { headers: [], columnDataRanges: {}, lastPlan: {}, etc. }
  
  -- Current task state (for multi-step persistence)
  current_task JSONB DEFAULT NULL,
  -- Format: { chainId, steps: [], currentStep, status }
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one conversation per user per spreadsheet
  UNIQUE(user_id, spreadsheet_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user 
  ON agent_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_spreadsheet 
  ON agent_conversations(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_interaction 
  ON agent_conversations(last_interaction_at DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_interaction_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON agent_conversations;
CREATE TRIGGER trigger_update_conversation_timestamp
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- ============================================
-- Proactive Analysis Cache (Sprint 3)
-- ============================================
-- Cache proactive analysis results to avoid re-analyzing on every load

CREATE TABLE IF NOT EXISTS agent_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  
  -- Analysis results
  analysis JSONB DEFAULT '{}'::jsonb,
  -- Format: { dataQuality: {}, opportunities: {}, suggestions: [] }
  
  -- Data fingerprint (to know if we need to re-analyze)
  data_fingerprint TEXT,
  -- Hash of: lastRow + lastCol + sample values
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  
  UNIQUE(user_id, spreadsheet_id, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_lookup 
  ON agent_analysis_cache(user_id, spreadsheet_id, sheet_name);

-- ============================================
-- Cleanup old conversations (optional)
-- ============================================
-- Conversations older than 30 days can be cleaned up

-- To run cleanup manually:
-- DELETE FROM agent_conversations 
-- WHERE last_interaction_at < NOW() - INTERVAL '30 days';

-- ============================================
-- Verification
-- ============================================

-- Check tables created successfully
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('agent_conversations', 'agent_analysis_cache');
