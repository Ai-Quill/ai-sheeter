-- ============================================
-- Migration: Add Suggestions Learning
-- Version: 1.0.0
-- Date: 2026-01-21
-- 
-- Adds columns to workflow_memory for learning
-- from successful suggestion usage.
-- ============================================

-- ============================================
-- SCHEMA UPDATES
-- ============================================

-- Add successful_suggestions column to track which suggestions work
ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS successful_suggestions JSONB DEFAULT '[]';

-- Add task_insight column for domain-specific completion messages
ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS task_insight JSONB DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN workflow_memory.successful_suggestions IS 
  'Array of suggestions that led to successful follow-up actions';

COMMENT ON COLUMN workflow_memory.task_insight IS 
  'Domain-specific completion insight {icon, message, tip}';

-- ============================================
-- INDEXES
-- ============================================

-- Index for faster GIN searches on suggestions array
CREATE INDEX IF NOT EXISTS idx_workflow_memory_suggestions 
ON workflow_memory USING GIN (successful_suggestions);

-- ============================================
-- FUNCTIONS
-- ============================================

/**
 * Record a successful suggestion for a workflow
 * Appends to the successful_suggestions array
 * 
 * @param p_workflow_id - UUID of the workflow
 * @param p_suggestion - JSONB object with suggestion data
 */
CREATE OR REPLACE FUNCTION record_successful_suggestion(
  p_workflow_id UUID,
  p_suggestion JSONB
) RETURNS VOID AS $$
BEGIN
  -- Only add if suggestion has required fields
  IF p_suggestion ? 'title' AND p_suggestion ? 'command' THEN
    UPDATE workflow_memory
    SET 
      successful_suggestions = successful_suggestions || p_suggestion,
      updated_at = NOW()
    WHERE id = p_workflow_id;
    
    -- Log for debugging
    IF NOT FOUND THEN
      RAISE NOTICE 'Workflow % not found for suggestion recording', p_workflow_id;
    END IF;
  ELSE
    RAISE NOTICE 'Invalid suggestion format - missing title or command';
  END IF;
END;
$$ LANGUAGE plpgsql;

/**
 * Update task insight for a workflow
 * Called after successful completion to store domain-specific insight
 * 
 * @param p_workflow_id - UUID of the workflow
 * @param p_insight - JSONB object with {icon, message, tip}
 */
CREATE OR REPLACE FUNCTION update_workflow_insight(
  p_workflow_id UUID,
  p_insight JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE workflow_memory
  SET 
    task_insight = p_insight,
    updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get workflows with successful suggestions
 * Returns workflows that have learned suggestions, ordered by usage
 * 
 * @param p_limit - Maximum number of results
 * @param p_domain - Optional domain filter
 */
CREATE OR REPLACE FUNCTION get_workflows_with_suggestions(
  p_limit INT DEFAULT 10,
  p_domain TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  command TEXT,
  domain TEXT,
  success_count INT,
  suggestion_count INT,
  successful_suggestions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.id,
    wm.command,
    wm.domain,
    wm.success_count,
    jsonb_array_length(wm.successful_suggestions) AS suggestion_count,
    wm.successful_suggestions
  FROM workflow_memory wm
  WHERE 
    jsonb_array_length(wm.successful_suggestions) > 0
    AND (p_domain IS NULL OR wm.domain = p_domain)
  ORDER BY 
    wm.success_count DESC,
    jsonb_array_length(wm.successful_suggestions) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_memory' 
    AND column_name = 'successful_suggestions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: successful_suggestions column not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_memory' 
    AND column_name = 'task_insight'
  ) THEN
    RAISE EXCEPTION 'Migration failed: task_insight column not created';
  END IF;
  
  RAISE NOTICE 'Migration successful: suggestions learning columns added';
END $$;
