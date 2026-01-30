-- ============================================
-- SKILL USAGE TRACKING
-- 
-- Tracks skill usage for learning and optimization:
-- - Which skills are used for which commands
-- - Success/failure rates per skill
-- - User edits (indicating suboptimal results)
-- - Performance metrics
--
-- Created: 2026-01-30
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SKILL USAGE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS skill_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Skill identification
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  
  -- Command that triggered this skill
  command TEXT NOT NULL,
  command_embedding vector(1536),  -- For finding similar commands/patterns
  
  -- Outcome tracking
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  user_edited BOOLEAN DEFAULT false,       -- Did user modify the AI result?
  execution_time_ms INTEGER,               -- How long did execution take?
  
  -- Context at time of execution
  data_context JSONB,                      -- What data was selected
  ai_response JSONB,                       -- What the AI returned
  
  -- Selection metadata
  confidence_score FLOAT,                  -- How confident was intent detection
  alternative_skills TEXT[],               -- What other skills were considered
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT skill_usage_skill_id_check CHECK (skill_id != '')
);

-- Index for finding usage by skill
CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_id ON skill_usage(skill_id, skill_version);

-- Index for finding recent usage
CREATE INDEX IF NOT EXISTS idx_skill_usage_created_at ON skill_usage(created_at DESC);

-- Index for finding failures
CREATE INDEX IF NOT EXISTS idx_skill_usage_success ON skill_usage(success) WHERE NOT success;

-- Index for finding user-edited results (indicating suboptimal AI output)
CREATE INDEX IF NOT EXISTS idx_skill_usage_user_edited ON skill_usage(user_edited) WHERE user_edited;

-- Vector index for finding similar command patterns
CREATE INDEX IF NOT EXISTS idx_skill_usage_embedding ON skill_usage 
  USING ivfflat (command_embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================
-- SKILL PERFORMANCE VIEW
-- ============================================

CREATE OR REPLACE VIEW skill_performance AS
SELECT 
  skill_id,
  skill_version,
  COUNT(*) as total_uses,
  COUNT(*) FILTER (WHERE success) as successes,
  COUNT(*) FILTER (WHERE NOT success) as failures,
  COUNT(*) FILTER (WHERE user_edited) as user_edits,
  AVG(execution_time_ms) as avg_execution_time_ms,
  ROUND(COUNT(*) FILTER (WHERE success)::numeric / NULLIF(COUNT(*), 0), 3) as success_rate,
  ROUND(COUNT(*) FILTER (WHERE user_edited)::numeric / NULLIF(COUNT(*), 0), 3) as edit_rate,
  MAX(created_at) as last_used_at,
  MIN(created_at) as first_used_at
FROM skill_usage
GROUP BY skill_id, skill_version;

-- ============================================
-- SKILL REVIEW FLAGS
-- ============================================

CREATE TABLE IF NOT EXISTS skill_review_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Which skill needs review
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  
  -- Why it was flagged
  flag_type TEXT NOT NULL CHECK (flag_type IN ('repeated_failure', 'low_success_rate', 'high_edit_rate')),
  
  -- Evidence
  example_usage_ids UUID[] NOT NULL,       -- References to skill_usage records
  pattern_description TEXT,                -- What pattern was detected
  suggested_fix TEXT,                      -- Auto-generated suggestion
  
  -- Review status
  reviewed BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resolution TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_review_flags_skill ON skill_review_flags(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_review_flags_unreviewed ON skill_review_flags(reviewed) WHERE NOT reviewed;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Record skill usage
CREATE OR REPLACE FUNCTION record_skill_usage(
  p_skill_id TEXT,
  p_skill_version TEXT,
  p_command TEXT,
  p_command_embedding vector(1536) DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_user_edited BOOLEAN DEFAULT false,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_data_context JSONB DEFAULT NULL,
  p_ai_response JSONB DEFAULT NULL,
  p_confidence_score FLOAT DEFAULT NULL,
  p_alternative_skills TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  INSERT INTO skill_usage (
    skill_id, skill_version, command, command_embedding,
    success, error_message, user_edited, execution_time_ms,
    data_context, ai_response, confidence_score, alternative_skills
  ) VALUES (
    p_skill_id, p_skill_version, p_command, p_command_embedding,
    p_success, p_error_message, p_user_edited, p_execution_time_ms,
    p_data_context, p_ai_response, p_confidence_score, p_alternative_skills
  ) RETURNING id INTO v_usage_id;
  
  -- Check if we need to flag this skill for review
  PERFORM check_skill_health(p_skill_id, p_skill_version);
  
  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- Check skill health and flag if needed
CREATE OR REPLACE FUNCTION check_skill_health(
  p_skill_id TEXT,
  p_skill_version TEXT
) RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_recent_failures UUID[];
  v_flag_exists BOOLEAN;
BEGIN
  -- Get recent stats (last 50 uses or last 7 days)
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE success) as successes,
    COUNT(*) FILTER (WHERE NOT success) as failures,
    COUNT(*) FILTER (WHERE user_edited) as edits
  INTO v_stats
  FROM skill_usage
  WHERE skill_id = p_skill_id 
    AND skill_version = p_skill_version
    AND created_at > NOW() - INTERVAL '7 days'
  LIMIT 50;
  
  -- Need at least 10 uses to evaluate
  IF v_stats.total < 10 THEN
    RETURN;
  END IF;
  
  -- Check for low success rate (<70%)
  IF v_stats.successes::float / v_stats.total < 0.7 THEN
    -- Check if already flagged
    SELECT EXISTS(
      SELECT 1 FROM skill_review_flags 
      WHERE skill_id = p_skill_id 
        AND skill_version = p_skill_version
        AND flag_type = 'low_success_rate'
        AND NOT reviewed
    ) INTO v_flag_exists;
    
    IF NOT v_flag_exists THEN
      -- Get recent failure IDs
      SELECT ARRAY_AGG(id) INTO v_recent_failures
      FROM (
        SELECT id FROM skill_usage
        WHERE skill_id = p_skill_id 
          AND skill_version = p_skill_version
          AND NOT success
        ORDER BY created_at DESC
        LIMIT 5
      ) f;
      
      INSERT INTO skill_review_flags (
        skill_id, skill_version, flag_type, example_usage_ids,
        pattern_description, suggested_fix
      ) VALUES (
        p_skill_id, p_skill_version, 'low_success_rate', v_recent_failures,
        format('Success rate dropped to %s%% (%s/%s)', 
          ROUND(v_stats.successes::float / v_stats.total * 100),
          v_stats.successes, v_stats.total),
        'Review recent failures and update skill instructions or examples'
      );
    END IF;
  END IF;
  
  -- Check for high edit rate (>30%)
  IF v_stats.edits::float / v_stats.total > 0.3 THEN
    SELECT EXISTS(
      SELECT 1 FROM skill_review_flags 
      WHERE skill_id = p_skill_id 
        AND skill_version = p_skill_version
        AND flag_type = 'high_edit_rate'
        AND NOT reviewed
    ) INTO v_flag_exists;
    
    IF NOT v_flag_exists THEN
      SELECT ARRAY_AGG(id) INTO v_recent_failures
      FROM (
        SELECT id FROM skill_usage
        WHERE skill_id = p_skill_id 
          AND skill_version = p_skill_version
          AND user_edited
        ORDER BY created_at DESC
        LIMIT 5
      ) f;
      
      INSERT INTO skill_review_flags (
        skill_id, skill_version, flag_type, example_usage_ids,
        pattern_description, suggested_fix
      ) VALUES (
        p_skill_id, p_skill_version, 'high_edit_rate', v_recent_failures,
        format('Edit rate is %s%% (%s/%s) - users frequently modify results', 
          ROUND(v_stats.edits::float / v_stats.total * 100),
          v_stats.edits, v_stats.total),
        'Analyze user edits to improve skill output quality'
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Find similar failed commands (for pattern detection)
CREATE OR REPLACE FUNCTION find_similar_failures(
  p_embedding vector(1536),
  p_skill_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.8
) RETURNS TABLE (
  id UUID,
  skill_id TEXT,
  command TEXT,
  error_message TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.skill_id,
    su.command,
    su.error_message,
    1 - (su.command_embedding <=> p_embedding) as similarity,
    su.created_at
  FROM skill_usage su
  WHERE NOT su.success
    AND su.command_embedding IS NOT NULL
    AND (p_skill_id IS NULL OR su.skill_id = p_skill_id)
    AND 1 - (su.command_embedding <=> p_embedding) > p_threshold
  ORDER BY su.command_embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get skill stats for the skill registry
CREATE OR REPLACE FUNCTION get_skill_stats(
  p_skill_id TEXT DEFAULT NULL
) RETURNS TABLE (
  skill_id TEXT,
  skill_version TEXT,
  total_uses BIGINT,
  success_rate NUMERIC,
  edit_rate NUMERIC,
  avg_execution_time_ms NUMERIC,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.skill_id,
    sp.skill_version,
    sp.total_uses,
    sp.success_rate,
    sp.edit_rate,
    sp.avg_execution_time_ms,
    sp.last_used_at
  FROM skill_performance sp
  WHERE p_skill_id IS NULL OR sp.skill_id = p_skill_id
  ORDER BY sp.total_uses DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE skill_usage IS 'Tracks every skill invocation for learning and optimization';
COMMENT ON TABLE skill_review_flags IS 'Flags skills that need human review due to poor performance';
COMMENT ON VIEW skill_performance IS 'Aggregated performance metrics per skill version';
COMMENT ON FUNCTION record_skill_usage IS 'Record a skill usage event and check health automatically';
COMMENT ON FUNCTION check_skill_health IS 'Check if a skill needs review based on recent performance';
COMMENT ON FUNCTION find_similar_failures IS 'Find similar failed commands using vector similarity';
