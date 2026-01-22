-- ============================================
-- Workflow Base Examples - Seed Data
-- Version: 1.0.0
-- Date: 2026-01-22
-- 
-- Seeds workflow_memory with base examples that serve as:
-- 1. Few-shot learning examples when no user workflows exist
-- 2. Public templates that users can browse and use
-- 3. Starter workflows for common use cases
-- ============================================

-- ============================================
-- SCHEMA UPDATES
-- ============================================

-- Add is_template flag to distinguish templates from user workflows
ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

-- Add is_public flag for user-contributed templates
ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Add template metadata
ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS template_name TEXT DEFAULT NULL;

ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS template_description TEXT DEFAULT NULL;

ALTER TABLE workflow_memory 
ADD COLUMN IF NOT EXISTS template_category TEXT DEFAULT NULL;

-- Index for template queries
CREATE INDEX IF NOT EXISTS idx_workflow_memory_templates 
ON workflow_memory (is_template, is_public) 
WHERE is_template = TRUE;

CREATE INDEX IF NOT EXISTS idx_workflow_memory_category 
ON workflow_memory (template_category) 
WHERE template_category IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN workflow_memory.is_template IS 
  'True for base examples and user-contributed templates';

COMMENT ON COLUMN workflow_memory.is_public IS 
  'True if template is publicly visible to all users';

COMMENT ON COLUMN workflow_memory.template_name IS 
  'Display name for the template (e.g., "Sales Pipeline Analysis")';

COMMENT ON COLUMN workflow_memory.template_description IS 
  'Brief description of what the template does and when to use it';

COMMENT ON COLUMN workflow_memory.template_category IS 
  'Category for browsing (sales, customer_feedback, hr, finance, marketing, data_quality, content)';

-- ============================================
-- FUNCTIONS
-- ============================================

/**
 * Get available workflow templates
 * Returns templates ordered by usage/success
 */
CREATE OR REPLACE FUNCTION get_workflow_templates(
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  template_name TEXT,
  template_description TEXT,
  template_category TEXT,
  command TEXT,
  workflow JSONB,
  success_count INT,
  domain TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.id,
    wm.template_name,
    wm.template_description,
    wm.template_category,
    wm.command,
    wm.workflow,
    wm.success_count,
    wm.domain
  FROM workflow_memory wm
  WHERE 
    wm.is_template = TRUE
    AND wm.is_public = TRUE
    AND (p_category IS NULL OR wm.template_category = p_category)
  ORDER BY 
    wm.success_count DESC,
    wm.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Get base examples for few-shot prompting
 * Similar to hardcoded base-examples.ts but from database
 */
CREATE OR REPLACE FUNCTION get_base_examples(
  p_count INT DEFAULT 10
) RETURNS TABLE (
  command TEXT,
  workflow JSONB,
  data_context JSONB,
  domain TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.command,
    wm.workflow,
    wm.data_context,
    wm.domain
  FROM workflow_memory wm
  WHERE 
    wm.is_template = TRUE
  ORDER BY 
    wm.success_count DESC,
    wm.last_used_at DESC NULLS LAST
  LIMIT p_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED BASE EXAMPLES
-- ============================================

-- These are the core examples from base-examples.ts
-- They will be used for few-shot prompting when no similar workflows exist

-- Example 1: Sales Pipeline Analysis
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Our sales team writes detailed notes but we don''t have time to read them all. We need pipeline insights, next steps, and risk flags.',
  '{
    "steps": [
      {
        "action": "extract",
        "description": "Extract buying signals and blockers from notes",
        "prompt": "Analyze these sales notes and extract:\n\n1. BUYING SIGNALS: Positive indicators (budget confirmed, timeline set, champion identified, decision maker engaged)\n2. BLOCKERS: Concerns, objections, or obstacles mentioned\n3. COMPETITORS: Any competitor mentions\n\nBe specific - quote the actual signals/blockers from the notes.\n\nFormat: Signal: [specific signal] | Blocker: [specific blocker] | Competitor: [name or \"none\"]",
        "outputFormat": "Signal | Blocker | Competitor"
      },
      {
        "action": "analyze",
        "description": "Assess deal health and win probability",
        "prompt": "Based on the deal stage, size, and the extracted signals/blockers, assess:\n\n1. DEAL HEALTH:\n   - Healthy: Strong signals, minor/no blockers\n   - At Risk: Mixed signals, significant blockers\n   - Critical: Weak signals, major blockers\n\n2. WIN PROBABILITY: High (70%+), Medium (40-70%), Low (<40%)\n\n3. KEY RISK: The single biggest factor that could kill this deal\n\nFormat: [Health] | [Probability] | Risk: [specific risk]",
        "outputFormat": "Health | Probability | Risk"
      },
      {
        "action": "generate",
        "description": "Generate specific next action for rep",
        "prompt": "Based on the deal status and risks identified, generate ONE specific, actionable next step.\n\nBe concrete and specific:\n- BAD: \"Follow up with customer\"\n- GOOD: \"Schedule technical deep-dive with CTO to address API integration concerns by Friday\"\n\nInclude: WHO should do WHAT by WHEN",
        "outputFormat": "Next action"
      }
    ],
    "summary": "3-step sales pipeline analysis: extract signals, assess health, generate actions",
    "clarification": "I''ll analyze each deal''s notes to extract buying signals and blockers, assess the deal health and win probability, and generate specific next actions for your reps."
  }'::JSONB,
  'sales',
  '{
    "dataColumns": ["C", "D", "E", "F"],
    "headers": {"C": "Company", "D": "Deal Size", "E": "Stage", "F": "Sales Notes"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Sales Pipeline Analysis',
  'Extract insights, assess deal health, and generate next actions from sales notes',
  'sales',
  10
) ON CONFLICT DO NOTHING;

-- Example 2: Customer Feedback Analysis
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Categorize customer feedback by sentiment and topic, then suggest appropriate responses',
  '{
    "steps": [
      {
        "action": "classify",
        "description": "Classify sentiment of feedback",
        "prompt": "Classify the sentiment of this customer feedback:\n\n- POSITIVE: Happy, satisfied, praising, recommending\n- NEGATIVE: Unhappy, frustrated, complaining, threatening to leave  \n- NEUTRAL: Factual, requesting information, neither positive nor negative\n- MIXED: Contains both positive and negative elements\n\nAlso rate intensity: Strong or Mild\n\nFormat: [Sentiment] ([Intensity])",
        "outputFormat": "Sentiment (Intensity)"
      },
      {
        "action": "extract",
        "description": "Extract main topic and specific issue",
        "prompt": "Extract the main topic and specific issue from this feedback:\n\nTOPICS: Product Quality, Customer Service, Pricing, Delivery, Usability, Feature Request, Bug Report, Other\n\nBe specific about WHAT exactly they''re commenting on.\n\nFormat: [Topic]: [Specific issue in 5-10 words]",
        "outputFormat": "Topic: Specific issue"
      },
      {
        "action": "generate",
        "description": "Draft appropriate response",
        "prompt": "Draft a brief, appropriate response to this feedback based on sentiment:\n\nFor NEGATIVE: Acknowledge, apologize, offer solution or escalation path\nFor POSITIVE: Thank them, encourage sharing/review, mention loyalty program\nFor NEUTRAL: Answer directly, provide requested info, offer further help\n\nKeep response under 50 words. Be empathetic and professional.",
        "outputFormat": "Draft response"
      }
    ],
    "summary": "3-step feedback analysis: classify sentiment, extract topic, draft response",
    "clarification": "I''ll classify each piece of feedback by sentiment, identify the main topic and issue, then draft an appropriate response you can customize."
  }'::JSONB,
  'customer_feedback',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Customer Name", "B": "Feedback Text", "C": "Date"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Customer Feedback Analysis',
  'Classify sentiment, extract topics, and draft responses for customer feedback',
  'customer_feedback',
  10
) ON CONFLICT DO NOTHING;

-- Example 3: Multi-Aspect Sentiment Analysis
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Analyze sentiment by aspect: rate Performance, UX, Pricing, and Features as Positive/Negative/Neutral for each feedback',
  '{
    "steps": [
      {
        "action": "classify",
        "description": "Rate sentiment for Performance, UX, Pricing, Features",
        "prompt": "Analyze this feedback and rate sentiment for EACH of these aspects:\n\n1. PERFORMANCE: Speed, reliability, uptime, responsiveness\n2. UX (User Experience): Ease of use, interface, design, navigation\n3. PRICING: Value for money, cost concerns, pricing model\n4. FEATURES: Functionality, capabilities, feature requests\n\nFor each aspect, return:\n- POSITIVE: If feedback explicitly praises this aspect\n- NEGATIVE: If feedback explicitly criticizes this aspect  \n- NEUTRAL: If aspect not mentioned OR neutral comment\n\nOutput exactly 4 values separated by \" | \".\n\nExample: \"Positive | Negative | Neutral | Positive\"",
        "outputFormat": "Performance | UX | Pricing | Features"
      }
    ],
    "summary": "Aspect-based sentiment analysis across 4 dimensions",
    "clarification": "I''ll analyze each piece of feedback and rate sentiment for Performance, UX, Pricing, and Features separately."
  }'::JSONB,
  'customer_feedback',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Customer", "B": "Feedback Text", "C": "Product"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Multi-Aspect Sentiment Analysis',
  'Analyze sentiment across multiple dimensions (Performance, UX, Pricing, Features)',
  'customer_feedback',
  10
) ON CONFLICT DO NOTHING;

-- Example 4: Resume Screening
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Screen these resumes against our job requirements and flag the best candidates',
  '{
    "steps": [
      {
        "action": "extract",
        "description": "Extract key qualifications from resume",
        "prompt": "Extract the following from this candidate''s resume/profile:\n\n1. YEARS OF EXPERIENCE: Total relevant years\n2. KEY SKILLS: Top 3-5 most relevant skills\n3. EDUCATION: Highest degree and field\n4. NOTABLE: Any standout achievements or companies\n\nFormat: [Years]yrs | Skills: [skill1, skill2, skill3] | [Degree] | Notable: [achievement]",
        "outputFormat": "Years | Skills | Education | Notable"
      },
      {
        "action": "classify",
        "description": "Rate match against typical job requirements",
        "prompt": "Rate how well this candidate matches typical requirements:\n\n- STRONG MATCH: Meets or exceeds all key requirements\n- GOOD MATCH: Meets most requirements, minor gaps\n- PARTIAL MATCH: Meets some requirements, notable gaps\n- WEAK MATCH: Missing several key requirements\n\nInclude the main strength and main gap.\n\nFormat: [Match Level] - Strength: [strength] | Gap: [gap or \"none\"]",
        "outputFormat": "Match Level - Strength | Gap"
      },
      {
        "action": "generate",
        "description": "Generate screening decision and notes",
        "prompt": "Based on the qualifications and match level, provide:\n\n1. DECISION: Advance (phone screen), Maybe (review with team), or Pass\n2. If Advance: 2 specific questions to ask in phone screen\n3. If Pass: Brief reason (for records)\n\nBe specific and actionable.",
        "outputFormat": "Decision + Notes"
      }
    ],
    "summary": "3-step resume screening: extract qualifications, rate match, generate decision",
    "clarification": "I''ll extract key qualifications from each resume, rate the match against requirements, and provide a screening decision with specific follow-up questions or notes."
  }'::JSONB,
  'hr_recruiting',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Candidate Name", "B": "Resume/Experience Summary", "C": "Applied Position"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Resume Screening',
  'Extract qualifications, match against requirements, and generate screening decisions',
  'hr',
  10
) ON CONFLICT DO NOTHING;

-- Example 5: Data Quality Check
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Check this data for quality issues and suggest corrections',
  '{
    "steps": [
      {
        "action": "validate",
        "description": "Check data completeness and format",
        "prompt": "Check this record for data quality issues:\n\n1. COMPLETENESS: Are required fields filled? (Name, Email required; Phone, Address optional)\n2. FORMAT: \n   - Email: valid format (x@y.z)?\n   - Phone: consistent format?\n   - Name: properly capitalized?\n3. OBVIOUS ERRORS: Typos, impossible values, test data\n\nFormat: [Complete/Incomplete] | Issues: [list issues or \"none\"]",
        "outputFormat": "Status | Issues"
      },
      {
        "action": "clean",
        "description": "Suggest corrected values",
        "prompt": "For any issues found, suggest the corrected value:\n\n- Fix capitalization (john doe → John Doe)\n- Fix obvious typos\n- Standardize phone format to (XXX) XXX-XXXX\n- Flag but don''t guess at missing data\n\nIf no corrections needed: \"No corrections\"\n\nFormat: [Field]: [Original] → [Corrected]",
        "outputFormat": "Corrections"
      }
    ],
    "summary": "2-step data validation: check quality, suggest corrections",
    "clarification": "I''ll check each record for completeness and format issues, then suggest specific corrections for any problems found."
  }'::JSONB,
  'data_quality',
  '{
    "dataColumns": ["A", "B", "C", "D"],
    "headers": {"A": "Name", "B": "Email", "C": "Phone", "D": "Address"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Data Quality Check',
  'Validate data completeness and format, suggest corrections for issues',
  'data_quality',
  10
) ON CONFLICT DO NOTHING;

-- Example 6: Content Summarization
INSERT INTO workflow_memory (
  command,
  workflow,
  domain,
  data_context,
  is_template,
  is_public,
  template_name,
  template_description,
  template_category,
  success_count
) VALUES (
  'Summarize these articles and extract the key takeaways',
  '{
    "steps": [
      {
        "action": "summarize",
        "description": "Create concise summary of article",
        "prompt": "Summarize this article in 2-3 sentences:\n\n1. What is the main topic/event?\n2. What is the key finding or conclusion?\n3. Why does it matter?\n\nBe concise but capture the essence. No filler words.",
        "outputFormat": "2-3 sentence summary"
      },
      {
        "action": "extract",
        "description": "Extract key takeaways and facts",
        "prompt": "Extract 2-3 key takeaways from this article:\n\nFocus on:\n- Actionable insights\n- Surprising facts or statistics\n- Important quotes or claims\n\nFormat as bullet points, each under 15 words.",
        "outputFormat": "Bullet point takeaways"
      }
    ],
    "summary": "2-step content analysis: summarize article, extract takeaways",
    "clarification": "I''ll create a concise summary of each article and extract the key takeaways you can quickly scan."
  }'::JSONB,
  'content',
  '{
    "dataColumns": ["A", "B", "C"],
    "headers": {"A": "Title", "B": "Article Text", "C": "Source"},
    "rowCount": 10
  }'::JSONB,
  TRUE,
  TRUE,
  'Content Summarization',
  'Summarize articles and extract key takeaways for quick scanning',
  'content',
  10
) ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
  COUNT(*) as template_count,
  COUNT(DISTINCT template_category) as categories
FROM workflow_memory 
WHERE is_template = TRUE;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Base examples seeded successfully into workflow_memory' AS status;
