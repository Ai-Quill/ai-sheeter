-- ============================================
-- DYNAMIC SKILL EXAMPLES
-- 
-- Extends skill_usage to support dynamic example loading:
-- - Mark successful executions as reusable examples
-- - Find similar examples by skill and embedding
-- - Quality scoring for example selection
--
-- Created: 2026-02-01
-- ============================================

-- ============================================
-- ADD COLUMNS FOR EXAMPLE TRACKING
-- ============================================

-- Add column to mark successful executions as good examples
ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS is_good_example BOOLEAN DEFAULT FALSE;

-- Add quality score for ranking examples (higher = better)
ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS example_quality_score FLOAT DEFAULT 0.5;

-- Index for quickly finding good examples by skill
CREATE INDEX IF NOT EXISTS idx_skill_usage_good_examples 
ON skill_usage(skill_id, is_good_example, created_at DESC) 
WHERE is_good_example = TRUE;

-- ============================================
-- FUNCTION: Find skill examples by similarity
-- ============================================

CREATE OR REPLACE FUNCTION find_skill_examples(
  p_skill_id TEXT,
  p_command_embedding vector(1536),
  p_limit INT DEFAULT 3,
  p_threshold FLOAT DEFAULT 0.5
) RETURNS TABLE (
  id UUID,
  command TEXT,
  ai_response JSONB,
  data_context JSONB,
  similarity FLOAT,
  quality_score FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.command,
    su.ai_response,
    su.data_context,
    1 - (su.command_embedding <=> p_command_embedding) as similarity,
    su.example_quality_score as quality_score,
    su.created_at
  FROM skill_usage su
  WHERE su.skill_id = p_skill_id
    AND su.is_good_example = TRUE
    AND su.success = TRUE
    AND su.command_embedding IS NOT NULL
    AND su.ai_response IS NOT NULL
    AND 1 - (su.command_embedding <=> p_command_embedding) > p_threshold
  ORDER BY 
    -- Combine similarity and quality score for ranking
    (1 - (su.command_embedding <=> p_command_embedding)) * 0.7 + su.example_quality_score * 0.3 DESC,
    su.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Mark execution as good example
-- ============================================

CREATE OR REPLACE FUNCTION mark_as_good_example(
  p_usage_id UUID,
  p_quality_score FLOAT DEFAULT 0.8
) RETURNS VOID AS $$
BEGIN
  UPDATE skill_usage
  SET 
    is_good_example = TRUE,
    example_quality_score = p_quality_score
  WHERE id = p_usage_id
    AND success = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Auto-mark successful execution as example
-- Called after successful sheet action execution
-- ============================================

CREATE OR REPLACE FUNCTION auto_mark_example(
  p_skill_id TEXT,
  p_command_embedding vector(1536)
) RETURNS VOID AS $$
DECLARE
  v_similar_count INT;
  v_usage_id UUID;
BEGIN
  -- Check if we already have similar examples for this skill
  SELECT COUNT(*) INTO v_similar_count
  FROM skill_usage
  WHERE skill_id = p_skill_id
    AND is_good_example = TRUE
    AND command_embedding IS NOT NULL
    AND 1 - (command_embedding <=> p_command_embedding) > 0.85;
  
  -- If we already have similar examples, don't add more (avoid duplicates)
  IF v_similar_count > 0 THEN
    RETURN;
  END IF;
  
  -- Find the most recent successful execution for this command pattern
  SELECT id INTO v_usage_id
  FROM skill_usage
  WHERE skill_id = p_skill_id
    AND success = TRUE
    AND command_embedding IS NOT NULL
    AND ai_response IS NOT NULL
    AND is_good_example = FALSE
    AND 1 - (command_embedding <=> p_command_embedding) > 0.95
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Mark it as a good example with default quality
  IF v_usage_id IS NOT NULL THEN
    UPDATE skill_usage
    SET 
      is_good_example = TRUE,
      example_quality_score = 0.7  -- Default quality for auto-marked examples
    WHERE id = v_usage_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get example count by skill
-- ============================================

CREATE OR REPLACE FUNCTION get_skill_example_count(
  p_skill_id TEXT DEFAULT NULL
) RETURNS TABLE (
  skill_id TEXT,
  example_count BIGINT,
  avg_quality FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.skill_id,
    COUNT(*) as example_count,
    AVG(su.example_quality_score)::FLOAT as avg_quality
  FROM skill_usage su
  WHERE su.is_good_example = TRUE
    AND (p_skill_id IS NULL OR su.skill_id = p_skill_id)
  GROUP BY su.skill_id
  ORDER BY example_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE record_skill_usage to support is_good_example
-- ============================================

-- Drop and recreate with new parameter
DROP FUNCTION IF EXISTS record_skill_usage(TEXT, TEXT, TEXT, vector, BOOLEAN, TEXT, BOOLEAN, INTEGER, JSONB, JSONB, FLOAT, TEXT[]);

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
  p_alternative_skills TEXT[] DEFAULT NULL,
  p_is_good_example BOOLEAN DEFAULT FALSE,
  p_example_quality_score FLOAT DEFAULT 0.5
) RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  INSERT INTO skill_usage (
    skill_id, skill_version, command, command_embedding,
    success, error_message, user_edited, execution_time_ms,
    data_context, ai_response, confidence_score, alternative_skills,
    is_good_example, example_quality_score
  ) VALUES (
    p_skill_id, p_skill_version, p_command, p_command_embedding,
    p_success, p_error_message, p_user_edited, p_execution_time_ms,
    p_data_context, p_ai_response, p_confidence_score, p_alternative_skills,
    p_is_good_example AND p_success,  -- Only mark as example if successful
    CASE WHEN p_success THEN p_example_quality_score ELSE 0 END
  ) RETURNING id INTO v_usage_id;
  
  -- Check if we need to flag this skill for review
  PERFORM check_skill_health(p_skill_id, p_skill_version);
  
  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN skill_usage.is_good_example IS 'Whether this execution should be used as a few-shot example';
COMMENT ON COLUMN skill_usage.example_quality_score IS 'Quality score for ranking examples (0-1, higher is better)';
COMMENT ON FUNCTION find_skill_examples IS 'Find similar successful examples for a skill using vector similarity';
COMMENT ON FUNCTION mark_as_good_example IS 'Manually mark an execution as a good example';
COMMENT ON FUNCTION auto_mark_example IS 'Auto-mark successful execution as example if no similar examples exist';
COMMENT ON FUNCTION get_skill_example_count IS 'Get count of examples per skill';
