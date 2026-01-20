-- ============================================
-- Workflow Memory - Semantic Search for Learned Workflows
-- ============================================
-- 
-- This table stores successful workflows with vector embeddings
-- for semantic similarity search. This enables the system to
-- find relevant examples regardless of exact phrasing.
--
-- Created: 2026-01-20

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- WORKFLOW MEMORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The original user command
  command TEXT NOT NULL,
  
  -- Vector embedding of the command (text-embedding-3-small = 1536 dimensions)
  command_embedding vector(1536),
  
  -- The successful workflow (JSON)
  workflow JSONB NOT NULL,
  
  -- Optional domain classification for filtering
  domain TEXT,
  
  -- Data context that was present (helps with matching)
  data_context JSONB,
  
  -- Success metrics
  success_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Vector similarity index using IVFFlat
-- Note: IVFFlat requires at least 1000 rows for optimal performance
-- For smaller datasets, exact search is used automatically
CREATE INDEX IF NOT EXISTS workflow_memory_embedding_idx 
ON workflow_memory 
USING ivfflat (command_embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for domain filtering
CREATE INDEX IF NOT EXISTS workflow_memory_domain_idx 
ON workflow_memory (domain);

-- Index for recency
CREATE INDEX IF NOT EXISTS workflow_memory_last_used_idx 
ON workflow_memory (last_used_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Find similar workflows using vector similarity
CREATE OR REPLACE FUNCTION find_similar_workflows(
  query_embedding vector(1536),
  match_count INT DEFAULT 3,
  match_threshold FLOAT DEFAULT 0.7,
  filter_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  command TEXT,
  workflow JSONB,
  domain TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.id,
    wm.command,
    wm.workflow,
    wm.domain,
    (1 - (wm.command_embedding <=> query_embedding))::FLOAT AS similarity
  FROM workflow_memory wm
  WHERE 
    wm.command_embedding IS NOT NULL
    AND (1 - (wm.command_embedding <=> query_embedding)) > match_threshold
    AND (filter_domain IS NULL OR wm.domain = filter_domain)
  ORDER BY wm.command_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Record workflow usage (increment success count, update last_used)
CREATE OR REPLACE FUNCTION record_workflow_memory_usage(
  p_workflow_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE workflow_memory
  SET 
    success_count = success_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$;

-- Upsert workflow memory (insert or update if similar exists)
CREATE OR REPLACE FUNCTION upsert_workflow_memory(
  p_command TEXT,
  p_embedding vector(1536),
  p_workflow JSONB,
  p_domain TEXT DEFAULT NULL,
  p_data_context JSONB DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- Check if very similar workflow already exists
  SELECT id INTO existing_id
  FROM workflow_memory
  WHERE command_embedding IS NOT NULL
    AND (1 - (command_embedding <=> p_embedding)) > similarity_threshold
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing - increment success count
    UPDATE workflow_memory
    SET 
      success_count = success_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
    WHERE id = existing_id;
    
    RETURN existing_id;
  ELSE
    -- Insert new
    INSERT INTO workflow_memory (command, command_embedding, workflow, domain, data_context)
    VALUES (p_command, p_embedding, p_workflow, p_domain, p_data_context)
    RETURNING id INTO new_id;
    
    RETURN new_id;
  END IF;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE workflow_memory ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (backend)
CREATE POLICY "Service role full access to workflow_memory"
ON workflow_memory
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_memory_updated_at
BEFORE UPDATE ON workflow_memory
FOR EACH ROW
EXECUTE FUNCTION update_workflow_memory_timestamp();

-- ============================================
-- DONE
-- ============================================
SELECT 'workflow_memory table created successfully' AS status;
