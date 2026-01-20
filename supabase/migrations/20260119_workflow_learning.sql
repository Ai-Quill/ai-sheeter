-- ============================================
-- Workflow Learning System Tables
-- ============================================
-- 
-- Enables the agent to learn and improve over time.
-- Stores actions, domains, workflows, and feedback.
--
-- Created: 2026-01-19

-- ============================================
-- 1. WORKFLOW ACTIONS
-- ============================================
-- Stores available actions (extract, analyze, etc.)
-- New actions can be learned from user patterns

CREATE TABLE IF NOT EXISTS workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  default_prompt_template TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.80,
  is_base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_workflow_actions_name ON workflow_actions(name);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_usage ON workflow_actions(usage_count DESC);

-- ============================================
-- 2. WORKFLOW DOMAINS
-- ============================================
-- Stores domain categories (sales, hr, etc.)
-- Keywords are regex patterns that trigger domain detection

CREATE TABLE IF NOT EXISTS workflow_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_workflow_domains_name ON workflow_domains(name);
CREATE INDEX IF NOT EXISTS idx_workflow_domains_usage ON workflow_domains(usage_count DESC);

-- ============================================
-- 3. WORKFLOW TEMPLATES
-- ============================================
-- Stores workflow templates (sequences of steps)
-- Learned from successful user interactions

CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES workflow_domains(id) ON DELETE SET NULL,
  trigger_patterns TEXT[] NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL,
  steps_hash VARCHAR(64),  -- Hash of step actions for deduplication
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.80,
  is_base BOOLEAN DEFAULT FALSE,
  source VARCHAR(50) DEFAULT 'manual',  -- manual, user_modification, ai_generated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_domain ON workflow_templates(domain_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_success ON workflow_templates(success_rate DESC, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_hash ON workflow_templates(steps_hash);

-- ============================================
-- 4. WORKFLOW FEEDBACK
-- ============================================
-- Tracks user interactions for learning

CREATE TABLE IF NOT EXISTS workflow_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  was_accepted BOOLEAN NOT NULL,
  was_modified BOOLEAN DEFAULT FALSE,
  final_steps JSONB,
  execution_success BOOLEAN,
  user_id VARCHAR(255),  -- Optional, for per-user learning
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_workflow_feedback_workflow ON workflow_feedback(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_feedback_created ON workflow_feedback(created_at DESC);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Increment workflow usage count
CREATE OR REPLACE FUNCTION increment_workflow_usage(p_workflow_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE workflow_templates 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- Increment workflow success count and recalculate rate
CREATE OR REPLACE FUNCTION increment_workflow_success(p_workflow_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE workflow_templates 
  SET success_count = success_count + 1,
      success_rate = CASE 
        WHEN usage_count > 0 THEN (success_count + 1)::DECIMAL / usage_count
        ELSE 1.0
      END,
      updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- Add keyword to domain
CREATE OR REPLACE FUNCTION add_domain_keyword(p_domain_id UUID, p_keyword TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE workflow_domains
  SET keywords = array_append(keywords, p_keyword),
      updated_at = NOW()
  WHERE id = p_domain_id
    AND NOT (p_keyword = ANY(keywords));  -- Don't add duplicates
END;
$$ LANGUAGE plpgsql;

-- Add trigger pattern to workflow
CREATE OR REPLACE FUNCTION add_workflow_trigger(p_workflow_id UUID, p_pattern TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE workflow_templates
  SET trigger_patterns = array_append(trigger_patterns, p_pattern),
      updated_at = NOW()
  WHERE id = p_workflow_id
    AND NOT (p_pattern = ANY(trigger_patterns));  -- Don't add duplicates
END;
$$ LANGUAGE plpgsql;

-- Increment action usage count
CREATE OR REPLACE FUNCTION increment_action_usage(p_action_name VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE workflow_actions 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE name = p_action_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. BASE DATA (Initial seed)
-- ============================================

-- Insert base actions (only if table is empty)
INSERT INTO workflow_actions (name, description, default_prompt_template, is_base)
SELECT * FROM (VALUES
  ('extract', 'Pull specific structured data from unstructured text', 'From this data, extract:\n1. {target1}\n2. {target2}\n3. {target3}\n\nFormat: {format}', TRUE),
  ('analyze', 'Complex reasoning to generate insights from multiple factors', 'Analyze this data considering all factors.\n\nProvide:\n1. Key insight\n2. Supporting evidence\n3. Confidence (High/Medium/Low)', TRUE),
  ('generate', 'Create new content like recommendations or action items', 'Based on the analysis, generate a specific, actionable recommendation.\n\nBe concrete - who should do what by when.', TRUE),
  ('classify', 'Assign to predefined categories', 'Classify as exactly ONE of:\n- {category1}\n- {category2}\n- {category3}\n\nFormat: [Category] - [Brief reason]', TRUE),
  ('summarize', 'Condense long text into shorter form', 'Summarize the key points in 1-2 sentences. Focus on what matters most.', TRUE),
  ('score', 'Assign numeric rating with reasoning', 'Score from 1-10 where:\n- 9-10: Exceptional\n- 7-8: Good\n- 5-6: Average\n- 3-4: Below average\n- 1-2: Poor\n\nFormat: [Score]/10 - [Reason]', TRUE),
  ('clean', 'Fix formatting and standardize data', 'Clean this data:\n- Fix formatting issues\n- Standardize format\n- Remove extra whitespace', TRUE),
  ('translate', 'Convert between languages', 'Translate to {language}. Preserve meaning and tone.', TRUE),
  ('validate', 'Check data quality and flag issues', 'Check for:\n- Missing information\n- Format issues\n- Logical errors\n\nFormat: [Valid/Invalid] - [Issues]', TRUE),
  ('rewrite', 'Transform tone or style of text', 'Rewrite to be {style}. Keep the core meaning.', TRUE)
) AS v(name, description, default_prompt_template, is_base)
WHERE NOT EXISTS (SELECT 1 FROM workflow_actions LIMIT 1);

-- Insert base domains
INSERT INTO workflow_domains (name, keywords, is_base)
SELECT * FROM (VALUES
  ('sales', ARRAY['sales?\s*(notes?|pipeline|deal)', 'deal\s*(size|stage)', 'buying\s*signal', 'objection', 'win\s*prob'], TRUE),
  ('customer_feedback', ARRAY['customer\s*(feedback|review|complaint)', 'nps|csat', 'support\s*ticket', 'user\s*(feedback|review)'], TRUE),
  ('hr_recruiting', ARRAY['candidate|applicant|resume', 'job\s*application', 'hiring|recruiting', 'interview\s*notes?'], TRUE),
  ('finance', ARRAY['invoice|payment|expense', 'budget|forecast', 'revenue|profit', 'financial\s*(data|report)'], TRUE),
  ('marketing', ARRAY['campaign|ad\s*performance', 'conversion|click', 'audience|segment', 'content\s*analysis'], TRUE)
) AS v(name, keywords, is_base)
WHERE NOT EXISTS (SELECT 1 FROM workflow_domains LIMIT 1);

-- Insert base workflow templates
-- Sales pipeline analysis workflow
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'sales'),
  ARRAY['insight|intelligence|signal', 'pipeline.*insight', 'deal.*health', 'risk.*flag'],
  '[
    {"action": "extract", "description": "Extract buying signals, objections, and competitors", "promptTemplate": "From this sales data, extract:\n1. Buying Signals: positive indicators (budget, champion, timeline)\n2. Objections: concerns or blockers\n3. Competitors: any competitor mentions\n\nFormat: Signal | Objection | Competitor", "outputFormat": "Signal | Objection | Competitor"},
    {"action": "analyze", "description": "Analyze deal health and win probability", "promptTemplate": "Based on deal data and extracted signals, provide:\n1. Win Probability: High, Medium, or Low\n2. Key Factor: The #1 thing affecting this deal\n\nFormat: [Probability] - [Reason]", "outputFormat": "Probability - Reason"},
    {"action": "generate", "description": "Generate specific next action", "promptTemplate": "Based on stage, signals, and win probability, generate ONE specific next step.\n\nBe specific: \"Schedule call with CFO\" not \"Follow up\"", "outputFormat": "Action item"}
  ]'::JSONB,
  TRUE,
  'manual'
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE is_base = TRUE LIMIT 1);

-- Customer feedback analysis workflow
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'customer_feedback'),
  ARRAY['sentiment|categorize', 'feedback.*analysis', 'review.*insight'],
  '[
    {"action": "classify", "description": "Classify sentiment", "promptTemplate": "Classify sentiment as:\n- Positive: Happy, satisfied\n- Negative: Unhappy, frustrated\n- Neutral: Factual, no emotion\n- Mixed: Both positive and negative", "outputFormat": "Sentiment"},
    {"action": "extract", "description": "Extract topic and issues", "promptTemplate": "Extract:\n1. Main Topic: What area is this about?\n2. Specific Issue: What exactly is the problem/praise?\n3. Actionable: Can we fix/improve? (Yes/No)\n\nFormat: Topic | Issue | Actionable", "outputFormat": "Topic | Issue | Actionable"},
    {"action": "generate", "description": "Generate response suggestion", "promptTemplate": "Suggest an appropriate response based on sentiment:\n- Negative: Acknowledge, apologize, offer solution\n- Positive: Thank, encourage sharing\n\nKeep under 2 sentences.", "outputFormat": "Response"}
  ]'::JSONB,
  TRUE,
  'manual'
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE is_base = TRUE AND domain_id = (SELECT id FROM workflow_domains WHERE name = 'customer_feedback'));

-- ============================================
-- 7. POLICIES (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_feedback ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend operations)
CREATE POLICY "Service role full access" ON workflow_actions FOR ALL USING (TRUE);
CREATE POLICY "Service role full access" ON workflow_domains FOR ALL USING (TRUE);
CREATE POLICY "Service role full access" ON workflow_templates FOR ALL USING (TRUE);
CREATE POLICY "Service role full access" ON workflow_feedback FOR ALL USING (TRUE);

-- ============================================
-- Done!
-- ============================================
