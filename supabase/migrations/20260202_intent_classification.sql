-- ============================================
-- UNIFIED INTENT CLASSIFICATION SYSTEM
-- ============================================
-- 
-- This migration creates the intent_cache table for the new
-- AI-driven intent classification system that replaces
-- hardcoded regex patterns.
--
-- The system uses:
-- 1. Embedding similarity for fast path (cached intents)
-- 2. AI classification for ambiguous cases
-- 3. Learning loop to improve over time
--
-- @version 1.0.0
-- @created 2026-02-02
-- ============================================

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- INTENT CACHE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The canonical command this intent represents
  canonical_command TEXT NOT NULL,
  
  -- Vector embedding for similarity search (1536 dimensions for text-embedding-3-small)
  embedding vector(1536) NOT NULL,
  
  -- The classification result (JSONB for flexibility)
  intent JSONB NOT NULL,
  -- intent structure:
  -- {
  --   "outputMode": "sheet|chat|formula|workflow",
  --   "skillId": "format|chart|...|null",
  --   "sheetAction": "chart|format|...|null",
  --   "confidence": 0.0-1.0
  -- }
  
  -- Usage statistics
  hit_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Computed success rate
  success_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN (success_count + failure_count) > 0 
    THEN success_count::float / (success_count + failure_count)
    ELSE 0.0 END
  ) STORED,
  
  -- Whether this is a manually created seed example
  is_seed BOOLEAN DEFAULT false,
  
  -- Category for organization (optional)
  category TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_intent_cache_embedding 
ON intent_cache USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for filtering by skill
CREATE INDEX IF NOT EXISTS idx_intent_cache_skill 
ON intent_cache ((intent->>'skillId'));

-- Index for filtering by output mode
CREATE INDEX IF NOT EXISTS idx_intent_cache_mode 
ON intent_cache ((intent->>'outputMode'));

-- Index for success rate filtering
CREATE INDEX IF NOT EXISTS idx_intent_cache_success_rate 
ON intent_cache (success_rate DESC);

-- ============================================
-- CLASSIFICATION OUTCOMES TABLE
-- ============================================
-- Records all classifications for learning loop

CREATE TABLE IF NOT EXISTS classification_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The command that was classified
  command TEXT NOT NULL,
  
  -- Vector embedding of the command
  embedding vector(1536),
  
  -- The classification that was used
  classification JSONB NOT NULL,
  
  -- Source: 'cache', 'ai', or 'fallback'
  source TEXT NOT NULL,
  
  -- Execution outcome
  success BOOLEAN,
  error_message TEXT,
  user_edited BOOLEAN DEFAULT false,
  
  -- Classification metrics
  classification_time_ms INTEGER,
  
  -- Reference to cache entry if used
  cache_entry_id UUID REFERENCES intent_cache(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding similar outcomes
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_embedding 
ON classification_outcomes USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for success rate analysis
CREATE INDEX IF NOT EXISTS idx_classification_outcomes_success 
ON classification_outcomes (success, created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to find similar intents by embedding
CREATE OR REPLACE FUNCTION find_similar_intents(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.85,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  canonical_command TEXT,
  intent JSONB,
  hit_count INTEGER,
  success_rate FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id,
    ic.canonical_command,
    ic.intent,
    ic.hit_count,
    ic.success_rate,
    1 - (ic.embedding <=> query_embedding) AS similarity
  FROM intent_cache ic
  WHERE 1 - (ic.embedding <=> query_embedding) >= similarity_threshold
    AND ic.success_rate >= 0.5  -- Only return entries with decent success rate
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

-- Function to record a cache hit
CREATE OR REPLACE FUNCTION record_intent_cache_hit(
  p_cache_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE intent_cache
  SET 
    hit_count = hit_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_cache_id;
END;
$$;

-- Function to record classification outcome
CREATE OR REPLACE FUNCTION record_classification_outcome(
  p_command TEXT,
  p_embedding vector(1536),
  p_classification JSONB,
  p_source TEXT,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_classification_time_ms INTEGER DEFAULT NULL,
  p_cache_entry_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_outcome_id UUID;
BEGIN
  -- Insert the outcome
  INSERT INTO classification_outcomes (
    command, embedding, classification, source, 
    success, error_message, classification_time_ms, cache_entry_id
  )
  VALUES (
    p_command, p_embedding, p_classification, p_source,
    p_success, p_error_message, p_classification_time_ms, p_cache_entry_id
  )
  RETURNING id INTO v_outcome_id;
  
  -- Update cache entry success/failure counts if from cache
  IF p_cache_entry_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE intent_cache SET success_count = success_count + 1, updated_at = NOW()
      WHERE id = p_cache_entry_id;
    ELSE
      UPDATE intent_cache SET failure_count = failure_count + 1, updated_at = NOW()
      WHERE id = p_cache_entry_id;
    END IF;
  END IF;
  
  RETURN v_outcome_id;
END;
$$;

-- Function to auto-promote successful classifications to cache
CREATE OR REPLACE FUNCTION promote_to_intent_cache(
  p_command TEXT,
  p_embedding vector(1536),
  p_classification JSONB,
  p_category TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cache_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check if similar intent already exists (similarity > 0.95)
  SELECT id INTO v_existing_id
  FROM intent_cache
  WHERE 1 - (embedding <=> p_embedding) > 0.95
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing entry
    UPDATE intent_cache
    SET 
      hit_count = hit_count + 1,
      success_count = success_count + 1,
      updated_at = NOW()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;
  
  -- Create new cache entry
  INSERT INTO intent_cache (
    canonical_command, embedding, intent, category,
    success_count, is_seed
  )
  VALUES (
    p_command, p_embedding, p_classification, p_category,
    1, false
  )
  RETURNING id INTO v_cache_id;
  
  RETURN v_cache_id;
END;
$$;

-- Function to get classification metrics
CREATE OR REPLACE FUNCTION get_classification_metrics(
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_metrics JSONB;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE source = 'cache') AS cache_hits,
      COUNT(*) FILTER (WHERE source = 'ai') AS ai_classifications,
      COUNT(*) FILTER (WHERE source = 'fallback') AS fallbacks,
      COUNT(*) FILTER (WHERE success = true) AS successes,
      AVG(classification_time_ms) AS avg_time
    FROM classification_outcomes
    WHERE created_at > NOW() - (p_days || ' days')::INTERVAL
  ),
  by_skill AS (
    SELECT
      classification->>'skillId' AS skill_id,
      COUNT(*) AS skill_count,
      COUNT(*) FILTER (WHERE success = true)::float / NULLIF(COUNT(*), 0) AS skill_success_rate
    FROM classification_outcomes
    WHERE created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY classification->>'skillId'
  )
  SELECT jsonb_build_object(
    'total', s.total,
    'cacheHitRate', s.cache_hits::float / NULLIF(s.total, 0),
    'aiClassificationRate', s.ai_classifications::float / NULLIF(s.total, 0),
    'fallbackRate', s.fallbacks::float / NULLIF(s.total, 0),
    'successRate', s.successes::float / NULLIF(s.total, 0),
    'avgClassificationTimeMs', s.avg_time,
    'bySkill', COALESCE(
      (SELECT jsonb_object_agg(skill_id, jsonb_build_object('count', skill_count, 'successRate', skill_success_rate))
       FROM by_skill WHERE skill_id IS NOT NULL),
      '{}'::jsonb
    )
  ) INTO v_metrics
  FROM stats s;
  
  RETURN v_metrics;
END;
$$;

-- ============================================
-- SEED DATA - 50+ CANONICAL EXAMPLES
-- ============================================
-- Note: Embeddings will be generated at runtime by the seeding script
-- This creates placeholder entries that will be updated with real embeddings

-- Create a temporary function to insert seed data without embeddings
-- The actual embeddings will be generated by the application on first run
CREATE OR REPLACE FUNCTION seed_intent_cache_placeholder(
  p_command TEXT,
  p_output_mode TEXT,
  p_skill_id TEXT,
  p_sheet_action TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert with a placeholder zero vector (will be updated by app)
  INSERT INTO intent_cache (
    canonical_command,
    embedding,
    intent,
    is_seed,
    category
  )
  VALUES (
    p_command,
    array_fill(0::float, ARRAY[1536])::vector,  -- Placeholder
    jsonb_build_object(
      'outputMode', p_output_mode,
      'skillId', p_skill_id,
      'sheetAction', p_sheet_action,
      'confidence', 1.0
    ),
    true,
    p_category
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================
-- CHART EXAMPLES (10)
-- ============================================
SELECT seed_intent_cache_placeholder('Create a pie chart', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Make a bar chart', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Create a line chart showing trends', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Visualize this data as a chart', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Plot revenue over time', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Create a scatter chart with trendline', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Make a column chart comparing values', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Create an area chart', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Show me a graph of sales', 'sheet', 'chart', 'chart', 'chart');
SELECT seed_intent_cache_placeholder('Create a combo chart with dual axis', 'sheet', 'chart', 'chart', 'chart');

-- ============================================
-- FORMAT EXAMPLES (10)
-- ============================================
SELECT seed_intent_cache_placeholder('Format as currency', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Make the headers bold', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Format column B as percentage', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Add borders to the table', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Center align all cells', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Format dates as MM/DD/YYYY', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Make header row blue with white text', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Format numbers with 2 decimal places', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Apply alternating row colors', 'sheet', 'format', 'format', 'format');
SELECT seed_intent_cache_placeholder('Merge cells A1 to D1', 'sheet', 'format', 'format', 'format');

-- ============================================
-- CONDITIONAL FORMAT EXAMPLES (8)
-- ============================================
SELECT seed_intent_cache_placeholder('Highlight cells greater than 100', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Color code negative values red', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Highlight duplicates', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Add a color scale from red to green', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Highlight cells containing Active', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Make overdue dates red', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Create a heat map of values', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');
SELECT seed_intent_cache_placeholder('Highlight the maximum value in each row', 'sheet', 'conditionalFormat', 'conditionalFormat', 'conditionalFormat');

-- ============================================
-- DATA VALIDATION EXAMPLES (8)
-- ============================================
SELECT seed_intent_cache_placeholder('Add a dropdown with High, Medium, Low', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Create checkboxes in column A', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Restrict to numbers between 1 and 100', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Add email validation', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Create a dropdown from another range', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Only allow dates after today', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Add URL validation to column C', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');
SELECT seed_intent_cache_placeholder('Restrict input to whole numbers only', 'sheet', 'dataValidation', 'dataValidation', 'dataValidation');

-- ============================================
-- FILTER EXAMPLES (6)
-- ============================================
SELECT seed_intent_cache_placeholder('Filter to show only Active status', 'sheet', 'filter', 'filter', 'filter');
SELECT seed_intent_cache_placeholder('Show rows where revenue is greater than 10000', 'sheet', 'filter', 'filter', 'filter');
SELECT seed_intent_cache_placeholder('Hide completed items', 'sheet', 'filter', 'filter', 'filter');
SELECT seed_intent_cache_placeholder('Filter by date range', 'sheet', 'filter', 'filter', 'filter');
SELECT seed_intent_cache_placeholder('Show only rows containing error', 'sheet', 'filter', 'filter', 'filter');
SELECT seed_intent_cache_placeholder('Filter to exclude cancelled orders', 'sheet', 'filter', 'filter', 'filter');

-- ============================================
-- WRITE DATA EXAMPLES (6)
-- ============================================
SELECT seed_intent_cache_placeholder('Create table with this data: | Name | Age |', 'sheet', 'writeData', 'writeData', 'writeData');
SELECT seed_intent_cache_placeholder('Paste this table into the sheet', 'sheet', 'writeData', 'writeData', 'writeData');
SELECT seed_intent_cache_placeholder('Write this CSV data', 'sheet', 'writeData', 'writeData', 'writeData');
SELECT seed_intent_cache_placeholder('Insert this data starting at B5', 'sheet', 'writeData', 'writeData', 'writeData');
SELECT seed_intent_cache_placeholder('Help me paste this: Name, Email, Phone', 'sheet', 'writeData', 'writeData', 'writeData');
SELECT seed_intent_cache_placeholder('Create a table from: | Product | Price | Qty |', 'sheet', 'writeData', 'writeData', 'writeData');

-- ============================================
-- SHEET OPERATIONS EXAMPLES (8)
-- ============================================
SELECT seed_intent_cache_placeholder('Freeze the first row', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Hide column C', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Sort by date descending', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Insert 3 rows after row 5', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Auto-fit all columns', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Rename this sheet to Summary', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Set tab color to blue', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');
SELECT seed_intent_cache_placeholder('Delete rows 10 to 15', 'sheet', 'sheetOps', 'sheetOps', 'sheetOps');

-- ============================================
-- FORMULA EXAMPLES (6)
-- ============================================
SELECT seed_intent_cache_placeholder('Translate column A to Spanish', 'formula', 'formula', NULL, 'formula');
SELECT seed_intent_cache_placeholder('Convert text to uppercase', 'formula', 'formula', NULL, 'formula');
SELECT seed_intent_cache_placeholder('Extract email domain', 'formula', 'formula', NULL, 'formula');
SELECT seed_intent_cache_placeholder('Trim whitespace from column B', 'formula', 'formula', NULL, 'formula');
SELECT seed_intent_cache_placeholder('Convert to lowercase', 'formula', 'formula', NULL, 'formula');
SELECT seed_intent_cache_placeholder('Translate to French', 'formula', 'formula', NULL, 'formula');

-- ============================================
-- CHAT/QUESTION EXAMPLES (8)
-- ============================================
SELECT seed_intent_cache_placeholder('What are the top 5 values?', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('Summarize this data for me', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('How many rows have Active status?', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('Which product has the highest sales?', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('Explain the trends in this data', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('What is the average revenue?', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('Compare Q1 and Q2 performance', 'chat', 'chat', NULL, 'chat');
SELECT seed_intent_cache_placeholder('Give me insights about this data', 'chat', 'chat', NULL, 'chat');

-- ============================================
-- CLEANUP
-- ============================================
DROP FUNCTION IF EXISTS seed_intent_cache_placeholder;

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE ON intent_cache TO authenticated;
GRANT SELECT, INSERT ON classification_outcomes TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_intents TO authenticated;
GRANT EXECUTE ON FUNCTION record_intent_cache_hit TO authenticated;
GRANT EXECUTE ON FUNCTION record_classification_outcome TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_intent_cache TO authenticated;
GRANT EXECUTE ON FUNCTION get_classification_metrics TO authenticated;
