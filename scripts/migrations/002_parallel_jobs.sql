-- ============================================
-- Migration 002: Parallel Job Processing
-- AISheeter v2.1.0
-- Run with: psql $DATABASE_URL -f 002_parallel_jobs.sql
-- 
-- Enables processing multiple jobs concurrently
-- for Vercel Pro + Supabase Pro environments
-- ============================================

-- Get multiple queued jobs atomically (with locking)
-- This allows the worker to process up to N jobs in parallel
CREATE OR REPLACE FUNCTION get_next_jobs(p_limit INTEGER DEFAULT 3)
RETURNS TABLE(job_id UUID) AS $$
BEGIN
  RETURN QUERY
  UPDATE jobs
  SET status = 'processing', started_at = NOW()
  WHERE id IN (
    SELECT id FROM jobs
    WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_next_jobs(INTEGER) IS 
  'Atomically claims up to N queued jobs for parallel processing. Uses SKIP LOCKED to avoid race conditions.';

SELECT 'Migration 002: Parallel job processing enabled!' AS status;
