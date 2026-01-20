-- ============================================
-- Workflow Learning - Extended Base Patterns
-- ============================================
-- 
-- Comprehensive set of workflow patterns for common data processing tasks.
-- Run this AFTER the main workflow_learning migration.
--
-- Created: 2026-01-19

-- ============================================
-- ADDITIONAL DOMAINS
-- ============================================

INSERT INTO workflow_domains (name, keywords, is_base) VALUES
  ('product', ARRAY['feature\s*request', 'bug\s*(report|triage)', 'user\s*(research|feedback)', 'product\s*(backlog|roadmap)', 'sprint\s*planning'], TRUE),
  ('operations', ARRAY['inventory|stock', 'supplier|vendor', 'quality\s*(control|check)', 'logistics|shipping', 'process\s*improvement'], TRUE),
  ('legal_compliance', ARRAY['contract\s*(review|analysis)', 'compliance\s*check', 'risk\s*assessment', 'legal\s*document', 'policy\s*review'], TRUE),
  ('data_quality', ARRAY['duplicate|dedup', 'data\s*(cleaning|quality)', 'validation|verify', 'enrichment|enrich', 'standardiz'], TRUE),
  ('research', ARRAY['survey\s*response', 'interview\s*(notes|transcript)', 'research\s*(data|finding)', 'qualitative\s*analysis', 'theme|pattern\s*analysis'], TRUE),
  ('ecommerce', ARRAY['order\s*(status|tracking)', 'return|refund', 'product\s*review', 'shopping\s*cart', 'customer\s*order'], TRUE),
  ('education', ARRAY['student\s*(feedback|assessment)', 'course\s*evaluation', 'learning\s*outcome', 'grade|grading', 'assignment\s*review'], TRUE),
  ('healthcare', ARRAY['patient\s*(feedback|notes)', 'medical\s*record', 'appointment|scheduling', 'treatment\s*plan', 'health\s*assessment'], TRUE),
  ('real_estate', ARRAY['property\s*(listing|description)', 'tenant\s*(screening|review)', 'lease\s*analysis', 'market\s*comparison', 'property\s*valuation'], TRUE),
  ('social_media', ARRAY['social\s*media\s*(post|comment)', 'engagement\s*analysis', 'influencer|creator', 'hashtag|mention', 'brand\s*mention'], TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SALES WORKFLOWS (Extended)
-- ============================================

-- Lead Scoring Workflow
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'sales'),
  ARRAY['lead\s*scor', 'qualify\s*lead', 'lead\s*qualification', 'hot\s*lead', 'warm\s*lead'],
  '[
    {"action": "extract", "description": "Extract lead qualification signals", "promptTemplate": "From this lead data, extract:\n1. Budget Indicator: Any mention of budget, spending, or investment capacity\n2. Authority: Who is the decision maker? What is their role?\n3. Need: What problem are they trying to solve?\n4. Timeline: When do they want to implement?\n\nFormat: Budget | Authority | Need | Timeline (use \"Unknown\" if not mentioned)", "outputFormat": "Budget | Authority | Need | Timeline"},
    {"action": "score", "description": "Score lead quality 1-10", "promptTemplate": "Based on the BANT criteria (Budget, Authority, Need, Timeline), score this lead:\n\n9-10: All 4 criteria strong (hot lead)\n7-8: 3 criteria strong (warm lead)\n5-6: 2 criteria strong (nurture)\n3-4: 1 criterion strong (cold)\n1-2: No clear criteria (unqualified)\n\nFormat: [Score]/10 - [Key reason]", "outputFormat": "Score/10 - Reason"},
    {"action": "generate", "description": "Generate recommended outreach approach", "promptTemplate": "Based on the lead score and BANT analysis, suggest the best outreach approach:\n\nFor hot leads (8+): Immediate call, personalized demo\nFor warm leads (5-7): Email sequence, case study\nFor cold leads (3-4): Nurture campaign, educational content\nFor unqualified (1-2): Disqualify or long-term nurture\n\nBe specific about the approach.", "outputFormat": "Outreach recommendation"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Competitor Mention Analysis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'sales'),
  ARRAY['competitor', 'competitive\s*analysis', 'vs\s*competitor', 'alternative', 'comparison'],
  '[
    {"action": "extract", "description": "Extract competitor mentions and context", "promptTemplate": "From this sales/customer data, identify:\n1. Competitor Name: Which competitor is mentioned?\n2. Context: Why are they mentioned? (pricing, features, switching from, considering)\n3. Sentiment: How does the customer feel about the competitor? (positive, negative, neutral)\n\nFormat: Competitor | Context | Sentiment", "outputFormat": "Competitor | Context | Sentiment"},
    {"action": "analyze", "description": "Analyze competitive positioning", "promptTemplate": "Based on the competitor mention and context, analyze:\n1. Threat Level: High (actively considering), Medium (just comparing), Low (mentioned in passing)\n2. Our Advantage: What can we emphasize against this competitor?\n3. Risk: What might we lose to this competitor?\n\nFormat: Threat: [Level] | Advantage: [point] | Risk: [concern]", "outputFormat": "Threat | Advantage | Risk"},
    {"action": "generate", "description": "Generate competitive response", "promptTemplate": "Generate a specific response strategy for this competitive situation:\n\n1. Key talking point to emphasize\n2. Objection to prepare for\n3. Proof point or case study to share\n\nBe specific to THIS competitor and situation.", "outputFormat": "Response strategy"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- CUSTOMER FEEDBACK WORKFLOWS (Extended)
-- ============================================

-- NPS Analysis Workflow
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'customer_feedback'),
  ARRAY['nps', 'net\s*promoter', 'promoter|detractor|passive', 'would\s*you\s*recommend', 'likelihood\s*to\s*recommend'],
  '[
    {"action": "classify", "description": "Classify NPS category", "promptTemplate": "Based on the NPS score or feedback sentiment, classify as:\n- Promoter (9-10): Enthusiastic, would recommend\n- Passive (7-8): Satisfied but not enthusiastic\n- Detractor (0-6): Unhappy, might discourage others\n\nIf no score given, infer from sentiment.", "outputFormat": "Promoter/Passive/Detractor"},
    {"action": "extract", "description": "Extract key driver of score", "promptTemplate": "What is the PRIMARY driver of this NPS response?\n\nFor Promoters: What do they love most?\nFor Passives: What would make them a promoter?\nFor Detractors: What is their main complaint?\n\nBe specific - identify the one key factor.", "outputFormat": "Key driver"},
    {"action": "generate", "description": "Generate follow-up action", "promptTemplate": "Based on the NPS category and key driver, suggest a follow-up action:\n\nPromoters: Ask for review, referral, or case study\nPassives: Address their \"wish\" to convert them\nDetractors: Escalate to support, offer resolution\n\nBe specific about WHO should do WHAT.", "outputFormat": "Follow-up action"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Support Ticket Triage
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'customer_feedback'),
  ARRAY['support\s*ticket', 'help\s*desk', 'customer\s*issue', 'ticket\s*triage', 'support\s*request'],
  '[
    {"action": "classify", "description": "Classify ticket urgency", "promptTemplate": "Classify the urgency of this support ticket:\n\n- Critical: System down, data loss, security issue, affecting many users\n- High: Major feature broken, significant business impact, VIP customer\n- Medium: Feature not working as expected, workaround available\n- Low: Question, minor issue, nice-to-have request\n\nFormat: [Urgency] - [Reason]", "outputFormat": "Urgency - Reason"},
    {"action": "classify", "description": "Categorize ticket type", "promptTemplate": "Categorize this ticket:\n\n- Bug: Something is broken/not working\n- Feature Request: Asking for new capability\n- How-To: Needs guidance on using the product\n- Account: Billing, access, subscription issue\n- Integration: Third-party connection issue\n- Other: Doesn''t fit above categories\n\nFormat: [Category]", "outputFormat": "Category"},
    {"action": "extract", "description": "Extract key details for routing", "promptTemplate": "Extract routing information:\n1. Product Area: Which part of the product is affected?\n2. Customer Tier: Enterprise, Pro, Free (if determinable)\n3. Technical Depth: Does this need engineering? (Yes/No)\n\nFormat: Area | Tier | Technical", "outputFormat": "Area | Tier | Technical"},
    {"action": "generate", "description": "Suggest initial response", "promptTemplate": "Draft an initial response for this ticket:\n\n1. Acknowledge the issue\n2. Set expectation for resolution time based on urgency\n3. Ask for any missing information needed\n\nKeep it concise and empathetic.", "outputFormat": "Response draft"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- HR/RECRUITING WORKFLOWS (Extended)
-- ============================================

-- Resume Screening
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'hr_recruiting'),
  ARRAY['resume\s*screen', 'cv\s*review', 'candidate\s*screen', 'application\s*review', 'initial\s*screen'],
  '[
    {"action": "extract", "description": "Extract key qualifications", "promptTemplate": "From this resume/application, extract:\n1. Years of Experience: Total relevant years\n2. Education: Highest degree and field\n3. Key Skills: Top 3-5 relevant skills\n4. Current/Last Role: Most recent position and company\n5. Location: Where are they based?\n\nFormat: Years | Education | Skills | Role | Location", "outputFormat": "Years | Education | Skills | Role | Location"},
    {"action": "classify", "description": "Match against job requirements", "promptTemplate": "Compare the candidate against typical job requirements:\n\n- Strong Match: Meets or exceeds all key requirements\n- Partial Match: Meets most requirements, some gaps\n- Weak Match: Missing several key requirements\n- No Match: Does not meet minimum requirements\n\nFormat: [Match Level] - [Key gap or strength]", "outputFormat": "Match Level - Reason"},
    {"action": "analyze", "description": "Identify red flags and highlights", "promptTemplate": "Analyze for:\n\n🚩 Red Flags: Job hopping, gaps, overqualified, underqualified\n⭐ Highlights: Relevant achievements, growth trajectory, unique skills\n\nFormat: Flags: [list] | Highlights: [list]", "outputFormat": "Flags | Highlights"},
    {"action": "generate", "description": "Generate screening decision", "promptTemplate": "Based on the analysis, provide a screening decision:\n\n- Advance: Move to phone screen\n- Maybe: Review with hiring manager\n- Reject: Send polite rejection\n\nInclude 1-2 specific questions to ask if advancing.", "outputFormat": "Decision + Questions"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Interview Feedback Synthesis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'hr_recruiting'),
  ARRAY['interview\s*(feedback|notes|debrief)', 'interviewer\s*feedback', 'hiring\s*decision', 'candidate\s*evaluation'],
  '[
    {"action": "extract", "description": "Extract interviewer assessments", "promptTemplate": "From this interview feedback, extract:\n1. Technical Skills: How did they assess technical ability?\n2. Soft Skills: Communication, collaboration, culture fit\n3. Concerns: Any red flags or hesitations\n4. Recommendation: Hire, No Hire, or Maybe\n\nFormat: Technical | Soft | Concerns | Recommendation", "outputFormat": "Technical | Soft | Concerns | Recommendation"},
    {"action": "analyze", "description": "Synthesize across interviewers", "promptTemplate": "Looking at all feedback, analyze:\n1. Consensus: Are interviewers aligned or divided?\n2. Key Strength: What do multiple interviewers praise?\n3. Key Concern: What concern appears multiple times?\n4. Open Questions: What wasn''t adequately assessed?\n\nFormat: Consensus | Strength | Concern | Gaps", "outputFormat": "Consensus | Strength | Concern | Gaps"},
    {"action": "generate", "description": "Generate hiring recommendation", "promptTemplate": "Based on the synthesized feedback, provide:\n1. Overall Recommendation: Strong Hire, Hire, Borderline, No Hire\n2. Confidence Level: High, Medium, Low\n3. Key Decision Factor: The single most important consideration\n4. Next Step: What should happen next?\n\nBe decisive but acknowledge uncertainty if present.", "outputFormat": "Recommendation + Next Steps"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- FINANCE WORKFLOWS
-- ============================================

-- Expense Categorization
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'finance'),
  ARRAY['expense\s*categor', 'expense\s*report', 'categorize\s*expense', 'expense\s*classif', 'spending\s*analysis'],
  '[
    {"action": "classify", "description": "Categorize expense type", "promptTemplate": "Categorize this expense into ONE of:\n\n- Travel: Flights, hotels, transportation, meals during travel\n- Office: Supplies, equipment, furniture\n- Software: SaaS subscriptions, licenses\n- Marketing: Ads, events, promotional materials\n- Professional Services: Legal, accounting, consulting\n- Payroll: Salaries, bonuses, benefits\n- Utilities: Phone, internet, electricity\n- Other: Doesn''t fit above\n\nFormat: [Category]", "outputFormat": "Category"},
    {"action": "classify", "description": "Flag for review", "promptTemplate": "Should this expense be flagged for review?\n\n- Flag: Missing receipt, unusual amount, unclear purpose, policy violation\n- OK: Normal expense, properly documented\n\nFormat: [Flag/OK] - [Reason if flagged]", "outputFormat": "Flag Status - Reason"},
    {"action": "extract", "description": "Extract key details", "promptTemplate": "Extract:\n1. Vendor: Who was paid?\n2. Amount: How much (if visible)?\n3. Date: When was this expense?\n4. Business Purpose: Why was this expense incurred?\n\nFormat: Vendor | Amount | Date | Purpose", "outputFormat": "Vendor | Amount | Date | Purpose"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Invoice Processing
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'finance'),
  ARRAY['invoice\s*process', 'invoice\s*review', 'payment\s*approv', 'accounts\s*payable', 'vendor\s*invoice'],
  '[
    {"action": "extract", "description": "Extract invoice details", "promptTemplate": "Extract from this invoice:\n1. Vendor Name\n2. Invoice Number\n3. Invoice Date\n4. Due Date\n5. Total Amount\n6. Line Items Summary\n\nFormat: Vendor | Invoice# | Date | Due | Amount | Items", "outputFormat": "Vendor | Invoice# | Date | Due | Amount | Items"},
    {"action": "validate", "description": "Check invoice validity", "promptTemplate": "Validate this invoice:\n\n✓ Has vendor info\n✓ Has invoice number\n✓ Has date and due date\n✓ Amounts are clear\n✓ Matches expected format\n\nFormat: [Valid/Invalid] - [Issues if any]", "outputFormat": "Valid/Invalid - Issues"},
    {"action": "classify", "description": "Determine approval routing", "promptTemplate": "Based on the amount and type, route for approval:\n\n- Auto-Approve: Under $500, recurring vendor\n- Manager Approval: $500-$5000\n- Director Approval: $5000-$25000\n- Finance Review: Over $25000 or unusual\n\nFormat: [Route] - [Approver role]", "outputFormat": "Route - Approver"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- MARKETING WORKFLOWS
-- ============================================

-- Campaign Performance Analysis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'marketing'),
  ARRAY['campaign\s*(performance|analysis)', 'ad\s*performance', 'marketing\s*roi', 'campaign\s*result'],
  '[
    {"action": "analyze", "description": "Analyze campaign metrics", "promptTemplate": "Analyze this campaign data:\n1. Performance vs Goal: Above, At, or Below target?\n2. Best Metric: What performed best?\n3. Worst Metric: What underperformed?\n4. Trend: Improving, stable, or declining?\n\nFormat: Performance | Best | Worst | Trend", "outputFormat": "Performance | Best | Worst | Trend"},
    {"action": "classify", "description": "Classify campaign health", "promptTemplate": "Rate overall campaign health:\n\n- Excellent: All KPIs above target\n- Good: Most KPIs at or above target\n- Needs Attention: Some KPIs below target\n- Critical: Major KPIs significantly below target\n\nFormat: [Health] - [Key concern or win]", "outputFormat": "Health - Reason"},
    {"action": "generate", "description": "Generate optimization recommendations", "promptTemplate": "Based on the analysis, suggest 2-3 specific optimizations:\n\n1. What to scale/increase (what''s working)\n2. What to fix/adjust (what''s underperforming)\n3. What to test next\n\nBe specific and actionable.", "outputFormat": "Optimization recommendations"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Content Performance Analysis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'marketing'),
  ARRAY['content\s*performance', 'blog\s*analysis', 'article\s*performance', 'content\s*engagement', 'top\s*performing\s*content'],
  '[
    {"action": "analyze", "description": "Analyze content performance", "promptTemplate": "Analyze this content piece:\n1. Engagement Level: High, Medium, Low (based on metrics)\n2. Best Performing Aspect: What drove the most engagement?\n3. Content Type: Blog, video, social, email, etc.\n4. Topic/Theme: What is this content about?\n\nFormat: Engagement | Best Aspect | Type | Topic", "outputFormat": "Engagement | Best Aspect | Type | Topic"},
    {"action": "extract", "description": "Extract content insights", "promptTemplate": "Extract insights:\n1. Target Audience: Who is this content for?\n2. Key Takeaway: What''s the main message?\n3. CTA: What action does it drive?\n4. Funnel Stage: Awareness, Consideration, or Decision?\n\nFormat: Audience | Takeaway | CTA | Stage", "outputFormat": "Audience | Takeaway | CTA | Stage"},
    {"action": "generate", "description": "Generate content recommendations", "promptTemplate": "Based on this content''s performance, suggest:\n1. Repurpose Idea: How to reuse this content in another format\n2. Follow-up Topic: Related content to create next\n3. Optimization: One thing to improve\n\nBe specific and creative.", "outputFormat": "Content recommendations"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUCT WORKFLOWS
-- ============================================

-- Feature Request Triage
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'product'),
  ARRAY['feature\s*request', 'product\s*feedback', 'user\s*request', 'enhancement\s*request', 'feature\s*idea'],
  '[
    {"action": "extract", "description": "Extract feature request details", "promptTemplate": "Extract from this feature request:\n1. Feature Summary: What are they asking for? (1 sentence)\n2. Use Case: Why do they need it? What problem does it solve?\n3. User Type: What kind of user is requesting this?\n4. Urgency: How urgent does this seem to them?\n\nFormat: Summary | Use Case | User Type | Urgency", "outputFormat": "Summary | Use Case | User Type | Urgency"},
    {"action": "classify", "description": "Categorize and prioritize", "promptTemplate": "Categorize this request:\n\nCategory:\n- Core Feature: Fundamental product capability\n- Enhancement: Improvement to existing feature\n- Integration: Connect with other tools\n- UX: User interface improvement\n- Performance: Speed/reliability improvement\n\nPriority (based on impact and frequency):\n- P1: Many users, high impact\n- P2: Some users, medium impact\n- P3: Few users, nice to have\n\nFormat: [Category] | [Priority]", "outputFormat": "Category | Priority"},
    {"action": "analyze", "description": "Assess feasibility and fit", "promptTemplate": "Analyze:\n1. Product Fit: Does this align with product vision? (Yes/Partial/No)\n2. Complexity Estimate: Simple, Medium, Complex\n3. Similar Requests: Is this commonly requested?\n4. Alternative: Is there an existing workaround?\n\nFormat: Fit | Complexity | Common | Alternative", "outputFormat": "Fit | Complexity | Common | Alternative"},
    {"action": "generate", "description": "Generate response and next steps", "promptTemplate": "Generate:\n1. User Response: Acknowledge the request professionally\n2. Internal Note: Recommendation for product team\n3. Next Step: What should happen with this request?\n\nBe helpful to the user while being realistic.", "outputFormat": "Response + Internal Note + Next Step"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Bug Report Triage
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'product'),
  ARRAY['bug\s*(report|triage)', 'issue\s*report', 'defect', 'not\s*working', 'broken'],
  '[
    {"action": "extract", "description": "Extract bug details", "promptTemplate": "Extract bug information:\n1. Issue Summary: What is broken? (1 sentence)\n2. Steps to Reproduce: How to recreate the issue\n3. Expected vs Actual: What should happen vs what happens\n4. Environment: Browser, OS, device if mentioned\n5. Frequency: Always, sometimes, or once?\n\nFormat: Summary | Steps | Expected/Actual | Environment | Frequency", "outputFormat": "Summary | Steps | Expected/Actual | Environment | Frequency"},
    {"action": "classify", "description": "Classify severity", "promptTemplate": "Classify bug severity:\n\n- Critical: System down, data loss, security issue\n- High: Major feature broken, no workaround\n- Medium: Feature impacted, workaround exists\n- Low: Minor issue, cosmetic, edge case\n\nFormat: [Severity] - [Impact description]", "outputFormat": "Severity - Impact"},
    {"action": "classify", "description": "Identify affected area", "promptTemplate": "Identify the affected product area:\n\n- Frontend/UI\n- Backend/API\n- Database\n- Authentication\n- Integration\n- Performance\n- Mobile\n- Other\n\nFormat: [Area]", "outputFormat": "Area"},
    {"action": "generate", "description": "Generate triage outcome", "promptTemplate": "Based on severity and details:\n1. Assignment: Which team should handle this?\n2. Response to User: Acknowledge and set expectation\n3. Quick Win: Any immediate workaround to suggest?\n\nFormat: Team | Response | Workaround", "outputFormat": "Team | Response | Workaround"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- DATA QUALITY WORKFLOWS
-- ============================================

-- Duplicate Detection
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'data_quality'),
  ARRAY['duplicate', 'dedup', 'merge\s*record', 'same\s*(person|company|record)', 'clean\s*duplicate'],
  '[
    {"action": "analyze", "description": "Identify potential duplicates", "promptTemplate": "Analyze this record for duplicate indicators:\n1. Name Similarity: Are there similar names that might be the same entity?\n2. Email/ID Match: Any matching unique identifiers?\n3. Address Similarity: Same or similar addresses?\n4. Confidence: How confident are you this might be a duplicate? (High/Medium/Low)\n\nFormat: Name | Email/ID | Address | Confidence", "outputFormat": "Name | Email/ID | Address | Confidence"},
    {"action": "classify", "description": "Recommend merge action", "promptTemplate": "Recommend action:\n\n- Merge: High confidence duplicate, combine records\n- Review: Medium confidence, needs human review\n- Keep Separate: Low confidence, probably different entities\n- Flag: Unusual pattern, investigate\n\nFormat: [Action] - [Reason]", "outputFormat": "Action - Reason"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Data Validation
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'data_quality'),
  ARRAY['validate\s*data', 'data\s*validation', 'check\s*data', 'verify\s*data', 'data\s*accuracy'],
  '[
    {"action": "validate", "description": "Check data completeness", "promptTemplate": "Check this record for completeness:\n\n✓ Required fields present\n✓ No empty critical values\n✓ Consistent formatting\n✓ Valid data types\n\nFormat: [Complete/Incomplete] - [Missing: list any gaps]", "outputFormat": "Complete/Incomplete - Gaps"},
    {"action": "validate", "description": "Check data accuracy", "promptTemplate": "Check for data quality issues:\n\n1. Typos: Obvious spelling errors\n2. Format Issues: Inconsistent formatting (dates, phones, etc.)\n3. Logic Errors: Values that don''t make sense\n4. Outdated: Information that seems old\n\nFormat: [Clean/Issues Found] - [List issues]", "outputFormat": "Clean/Issues - Details"},
    {"action": "clean", "description": "Suggest corrections", "promptTemplate": "For any issues found, suggest the corrected value.\n\nFormat: Original | Issue | Suggested Correction\n\nIf no issues, respond: No corrections needed", "outputFormat": "Corrections"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Data Enrichment
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'data_quality'),
  ARRAY['enrich\s*data', 'data\s*enrichment', 'add\s*info', 'complete\s*record', 'fill\s*in\s*missing'],
  '[
    {"action": "analyze", "description": "Identify enrichment opportunities", "promptTemplate": "What information could be added to this record?\n\n1. From Context: What can be inferred from existing data?\n2. From Name: Company type, industry hints from name\n3. From Location: Region, timezone, market size\n4. Missing Fields: What standard fields are empty?\n\nFormat: Inference | Name Hints | Location Hints | Missing", "outputFormat": "Inference | Name Hints | Location Hints | Missing"},
    {"action": "generate", "description": "Generate enriched values", "promptTemplate": "Based on the available information, suggest values for:\n\n1. Industry/Category (if determinable)\n2. Company Size (if any hints)\n3. Region/Territory\n4. Any other inferable fields\n\nOnly suggest values you have reasonable confidence in.\nFormat: Field: Value | Field: Value | ...", "outputFormat": "Enriched values"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- RESEARCH WORKFLOWS
-- ============================================

-- Survey Response Analysis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'research'),
  ARRAY['survey\s*response', 'survey\s*analysis', 'response\s*analysis', 'survey\s*result', 'questionnaire'],
  '[
    {"action": "classify", "description": "Classify response sentiment", "promptTemplate": "Classify the overall sentiment of this survey response:\n\n- Very Positive: Enthusiastic, praising, highly satisfied\n- Positive: Generally satisfied, good feedback\n- Neutral: Mixed or factual response\n- Negative: Dissatisfied, complaining\n- Very Negative: Angry, threatening to leave\n\nFormat: [Sentiment]", "outputFormat": "Sentiment"},
    {"action": "extract", "description": "Extract key themes", "promptTemplate": "Extract the main themes from this response:\n1. Primary Theme: The main topic they''re discussing\n2. Secondary Theme: Any other topic mentioned\n3. Specific Feedback: Concrete suggestions or complaints\n4. Quotable: A key phrase that captures their sentiment\n\nFormat: Primary | Secondary | Specific | Quote", "outputFormat": "Primary | Secondary | Specific | Quote"},
    {"action": "classify", "description": "Tag for follow-up", "promptTemplate": "Should this response be followed up?\n\n- Urgent Follow-up: Very negative, churn risk, or specific complaint\n- Schedule Follow-up: Has actionable feedback worth discussing\n- No Follow-up: Positive or neutral, no action needed\n- Share Internally: Contains praise worth sharing\n\nFormat: [Action] - [Reason]", "outputFormat": "Action - Reason"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Interview Transcript Analysis
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  (SELECT id FROM workflow_domains WHERE name = 'research'),
  ARRAY['interview\s*transcript', 'user\s*interview', 'qualitative\s*analysis', 'research\s*interview', 'interview\s*analysis'],
  '[
    {"action": "extract", "description": "Extract key quotes and insights", "promptTemplate": "From this interview excerpt, extract:\n1. Key Quote: The most insightful or important statement\n2. Pain Point: What problem or frustration did they mention?\n3. Need: What do they need or want?\n4. Behavior: Any interesting behavior or habit mentioned\n\nFormat: Quote | Pain Point | Need | Behavior", "outputFormat": "Quote | Pain Point | Need | Behavior"},
    {"action": "classify", "description": "Tag with research themes", "promptTemplate": "Tag this excerpt with relevant themes:\n\nChoose all that apply:\n- Usability\n- Feature Gap\n- Workflow\n- Integration\n- Pricing\n- Support\n- Competition\n- Satisfaction\n- Frustration\n\nFormat: [Theme1, Theme2, ...]", "outputFormat": "Themes"},
    {"action": "analyze", "description": "Assess insight value", "promptTemplate": "Rate the insight value of this excerpt:\n\n- High Value: New insight, actionable, representative\n- Medium Value: Confirms existing knowledge, somewhat useful\n- Low Value: Already known, not actionable\n\nFormat: [Value] - [Why this is valuable or not]", "outputFormat": "Value - Reason"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- GENERAL PURPOSE WORKFLOWS
-- ============================================

-- Text Summarization
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  NULL,
  ARRAY['summarize', 'summary', 'brief', 'condense', 'tldr', 'key\s*point'],
  '[
    {"action": "summarize", "description": "Create concise summary", "promptTemplate": "Summarize this text in 1-2 sentences, capturing:\n1. The main point or topic\n2. The key conclusion or action\n\nBe concise but complete.", "outputFormat": "Summary"},
    {"action": "extract", "description": "Extract key points", "promptTemplate": "Extract 3-5 key points or takeaways from this text.\n\nFormat as bullet points, each under 15 words.", "outputFormat": "Key points"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Translation
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  NULL,
  ARRAY['translate', 'translation', 'to\s*(spanish|french|german|chinese|japanese)', 'in\s*(spanish|french|german|chinese|japanese)'],
  '[
    {"action": "translate", "description": "Translate to target language", "promptTemplate": "Translate this text accurately to the target language.\n\nPreserve:\n- Tone and formality level\n- Technical terms where appropriate\n- Cultural context\n\nIf target language is unclear, translate to English.", "outputFormat": "Translated text"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Sentiment Analysis (General)
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  NULL,
  ARRAY['sentiment', 'positive\s*or\s*negative', 'tone\s*analysis', 'emotional\s*tone', 'feeling'],
  '[
    {"action": "classify", "description": "Classify sentiment", "promptTemplate": "Analyze the sentiment of this text:\n\n- Positive: Happy, satisfied, optimistic, praising\n- Negative: Unhappy, frustrated, critical, complaining\n- Neutral: Factual, objective, no strong emotion\n- Mixed: Contains both positive and negative elements\n\nFormat: [Sentiment] - [Key indicator]", "outputFormat": "Sentiment - Indicator"},
    {"action": "score", "description": "Score sentiment intensity", "promptTemplate": "Score the intensity of the sentiment from 1-5:\n\n1: Very negative/critical\n2: Somewhat negative\n3: Neutral\n4: Somewhat positive\n5: Very positive/enthusiastic\n\nFormat: [Score]/5", "outputFormat": "Score/5"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- Entity Extraction (General)
INSERT INTO workflow_templates (domain_id, trigger_patterns, steps, is_base, source)
SELECT 
  NULL,
  ARRAY['extract\s*(name|email|phone|date|company|location)', 'find\s*(name|email|phone|date|company|location)', 'pull\s*out', 'identify\s*entities'],
  '[
    {"action": "extract", "description": "Extract entities from text", "promptTemplate": "Extract the following from this text (if present):\n\n1. People Names\n2. Company/Organization Names\n3. Locations (cities, countries)\n4. Dates/Times\n5. Email Addresses\n6. Phone Numbers\n7. Monetary Amounts\n\nFormat: Type: Value | Type: Value | ...\nIf not found, omit that type.", "outputFormat": "Entity extraction"}
  ]'::JSONB,
  TRUE,
  'manual'
ON CONFLICT DO NOTHING;

-- ============================================
-- Done!
-- ============================================
SELECT 'Seed data inserted successfully. Total workflows: ' || COUNT(*) FROM workflow_templates;
