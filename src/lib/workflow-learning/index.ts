/**
 * @deprecated This module has been replaced by the semantic workflow system.
 * 
 * NEW SYSTEM: Use @/lib/workflow-memory instead
 * - Uses embeddings for semantic search (not regex patterns)
 * - Few-shot learning with concrete examples
 * - Stores successful workflows in workflow_memory table
 * 
 * This file is kept for backward compatibility with the old database tables
 * (workflow_actions, workflow_domains, workflow_templates).
 * 
 * For new code, import from:
 *   import { findSimilarWorkflows, storeWorkflow } from '@/lib/workflow-memory';
 *   import { buildFewShotPrompt } from '@/lib/workflow-memory/prompt-builder';
 * 
 * @version 1.0.0 (DEPRECATED)
 * @updated 2026-01-19
 * @deprecated 2026-01-20 - Use @/lib/workflow-memory instead
 */

import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface LearnedAction {
  id: string;
  name: string;
  description: string;
  defaultPromptTemplate: string;
  usageCount: number;
  successRate: number;
  isBase: boolean;  // Base actions can't be deleted
}

export interface LearnedDomain {
  id: string;
  name: string;
  keywords: string[];  // Regex patterns
  usageCount: number;
  isBase: boolean;
}

export interface LearnedWorkflow {
  id: string;
  domainId: string | null;
  triggerPatterns: string[];  // Regex patterns
  steps: WorkflowStep[];
  usageCount: number;
  successCount: number;
  successRate: number;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  action: string;
  description: string;
  promptTemplate: string;
  outputFormat?: string;
}

export interface WorkflowFeedback {
  workflowId: string;
  wasAccepted: boolean;
  wasModified: boolean;
  finalSteps?: WorkflowStep[];
  executionSuccess?: boolean;
}

// ============================================
// IN-MEMORY CACHE
// ============================================

let actionsCache: LearnedAction[] = [];
let domainsCache: LearnedDomain[] = [];
let workflowsCache: LearnedWorkflow[] = [];
let cacheLastUpdated: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

// ============================================
// BASE PATTERNS (Fallback when DB empty)
// ============================================

const BASE_ACTIONS: Omit<LearnedAction, 'id'>[] = [
  { name: 'extract', description: 'Pull specific structured data from unstructured text', defaultPromptTemplate: 'From this data, extract:\n1. {target1}\n2. {target2}\n3. {target3}\n\nFormat: {format}', usageCount: 0, successRate: 0.8, isBase: true },
  { name: 'analyze', description: 'Complex reasoning to generate insights from multiple factors', defaultPromptTemplate: 'Analyze this data considering all factors.\n\nProvide:\n1. Key insight\n2. Supporting evidence\n3. Confidence (High/Medium/Low)', usageCount: 0, successRate: 0.8, isBase: true },
  { name: 'generate', description: 'Create new content like recommendations or action items', defaultPromptTemplate: 'Based on the analysis, generate a specific, actionable recommendation.\n\nBe concrete - who should do what by when.', usageCount: 0, successRate: 0.8, isBase: true },
  { name: 'classify', description: 'Assign to predefined categories', defaultPromptTemplate: 'Classify as exactly ONE of:\n- {category1}\n- {category2}\n- {category3}\n\nFormat: [Category] - [Brief reason]', usageCount: 0, successRate: 0.9, isBase: true },
  { name: 'summarize', description: 'Condense long text into shorter form', defaultPromptTemplate: 'Summarize the key points in 1-2 sentences. Focus on what matters most.', usageCount: 0, successRate: 0.9, isBase: true },
  { name: 'score', description: 'Assign numeric rating with reasoning', defaultPromptTemplate: 'Score from 1-10 where:\n- 9-10: Exceptional\n- 7-8: Good\n- 5-6: Average\n- 3-4: Below average\n- 1-2: Poor\n\nFormat: [Score]/10 - [Reason]', usageCount: 0, successRate: 0.85, isBase: true },
  { name: 'clean', description: 'Fix formatting and standardize data', defaultPromptTemplate: 'Clean this data:\n- Fix formatting issues\n- Standardize format\n- Remove extra whitespace', usageCount: 0, successRate: 0.95, isBase: true },
  { name: 'translate', description: 'Convert between languages', defaultPromptTemplate: 'Translate to {language}. Preserve meaning and tone.', usageCount: 0, successRate: 0.9, isBase: true },
  { name: 'validate', description: 'Check data quality and flag issues', defaultPromptTemplate: 'Check for:\n- Missing information\n- Format issues\n- Logical errors\n\nFormat: [Valid/Invalid] - [Issues]', usageCount: 0, successRate: 0.85, isBase: true },
  { name: 'rewrite', description: 'Transform tone or style of text', defaultPromptTemplate: 'Rewrite to be {style}. Keep the core meaning.', usageCount: 0, successRate: 0.85, isBase: true },
];

const BASE_DOMAINS: Omit<LearnedDomain, 'id'>[] = [
  { name: 'sales', keywords: ['sales\\s*(rep|notes?|pipeline|deal)', 'pipeline\\s*insight', 'deal\\s*(size|stage|health|falling)', 'buying\\s*signal', 'objection', 'win\\s*prob', 'lead\\s*scor', 'competitor', 'next\\s*step.*deal'], usageCount: 0, isBase: true },
  { name: 'customer_feedback', keywords: ['customer\\s*(feedback|review|complaint)', 'nps|csat', 'support\\s*ticket', 'user\\s*(feedback|review)', 'sentiment'], usageCount: 0, isBase: true },
  { name: 'hr_recruiting', keywords: ['candidate|applicant|resume', 'job\\s*application', 'hiring|recruiting', 'interview\\s*(notes?|feedback)', 'employee\\s*(review|performance)'], usageCount: 0, isBase: true },
  { name: 'finance', keywords: ['invoice|payment|expense', 'budget|forecast', 'revenue|profit', 'financial\\s*(data|report)', 'accounts\\s*payable'], usageCount: 0, isBase: true },
  { name: 'marketing', keywords: ['campaign|ad\\s*performance', 'conversion|click', 'audience|segment', 'content\\s*(performance|analysis)', 'marketing\\s*roi'], usageCount: 0, isBase: true },
  { name: 'product', keywords: ['feature\\s*request', 'bug\\s*(report|triage)', 'user\\s*research', 'product\\s*backlog', 'sprint'], usageCount: 0, isBase: true },
  { name: 'data_quality', keywords: ['duplicate|dedup', 'data\\s*(cleaning|quality)', 'validation|verify', 'enrichment', 'standardiz'], usageCount: 0, isBase: true },
  { name: 'research', keywords: ['survey\\s*response', 'interview\\s*transcript', 'qualitative', 'research\\s*(data|finding)'], usageCount: 0, isBase: true },
  { name: 'operations', keywords: ['inventory|stock', 'supplier|vendor', 'quality\\s*control', 'logistics|shipping'], usageCount: 0, isBase: true },
  { name: 'ecommerce', keywords: ['order\\s*(status|tracking)', 'return|refund', 'product\\s*review', 'customer\\s*order'], usageCount: 0, isBase: true },
];

const BASE_WORKFLOWS: Omit<LearnedWorkflow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    domainId: null, // Will be linked to 'sales' domain
    triggerPatterns: ['insight|intelligence|signal|objection|risk', 'pipeline.*insight', 'deal.*health'],
    steps: [
      { action: 'extract', description: 'Extract buying signals, objections, and competitors', promptTemplate: 'From this sales data, extract:\n1. Buying Signals: positive indicators (budget, champion, timeline)\n2. Objections: concerns or blockers\n3. Competitors: any competitor mentions\n\nFormat: Signal | Objection | Competitor', outputFormat: 'Signal | Objection | Competitor' },
      { action: 'analyze', description: 'Analyze deal health and win probability', promptTemplate: 'Based on deal data and extracted signals, provide:\n1. Win Probability: High, Medium, or Low\n2. Key Factor: The #1 thing affecting this deal\n\nFormat: [Probability] - [Reason]', outputFormat: 'Probability - Reason' },
      { action: 'generate', description: 'Generate specific next action', promptTemplate: 'Based on stage, signals, and win probability, generate ONE specific next step.\n\nBe specific: "Schedule call with CFO" not "Follow up"', outputFormat: 'Action item' },
    ],
    usageCount: 0,
    successCount: 0,
    successRate: 0.8,
    isBase: true,
  },
  {
    domainId: null, // Will be linked to 'customer_feedback' domain
    triggerPatterns: ['sentiment|categorize|theme', 'feedback.*analysis', 'review.*insight'],
    steps: [
      { action: 'classify', description: 'Classify sentiment', promptTemplate: 'Classify sentiment as:\n- Positive: Happy, satisfied\n- Negative: Unhappy, frustrated\n- Neutral: Factual, no emotion\n- Mixed: Both positive and negative', outputFormat: 'Sentiment' },
      { action: 'extract', description: 'Extract topic and issues', promptTemplate: 'Extract:\n1. Main Topic: What area is this about?\n2. Specific Issue: What exactly is the problem/praise?\n3. Actionable: Can we fix/improve? (Yes/No)\n\nFormat: Topic | Issue | Actionable', outputFormat: 'Topic | Issue | Actionable' },
      { action: 'generate', description: 'Generate response suggestion', promptTemplate: 'Suggest an appropriate response based on sentiment:\n- Negative: Acknowledge, apologize, offer solution\n- Positive: Thank, encourage sharing\n- Neutral: Answer directly\n\nKeep under 2 sentences.', outputFormat: 'Response' },
    ],
    usageCount: 0,
    successCount: 0,
    successRate: 0.8,
    isBase: true,
  },
  // Sales Notes Analysis (matches the demo 7 scenario)
  {
    domainId: null,
    triggerPatterns: ['nobody.*time.*read', 'leadership.*want.*insight', 'pipeline\\s*insight', 'falling\\s*through.*crack', 'sales\\s*rep.*notes'],
    steps: [
      { action: 'extract', description: 'Extract key signals from sales notes', promptTemplate: 'From these sales notes, extract:\n1. Buying Signal: positive indicators (budget, timeline, champion)\n2. Objection/Blocker: concerns or obstacles mentioned\n3. Competitor: any competitor mentions\n\nFormat: Signal | Blocker | Competitor', outputFormat: 'Signal | Blocker | Competitor' },
      { action: 'analyze', description: 'Analyze deal health and risk', promptTemplate: 'Based on the signals and blockers, analyze:\n1. Deal Health: Healthy, At Risk, or Critical\n2. Win Probability: High, Medium, or Low\n3. Key Risk: The #1 factor that could kill this deal\n\nFormat: [Health] | [Probability] | [Risk]', outputFormat: 'Health | Probability | Risk' },
      { action: 'generate', description: 'Generate specific next action', promptTemplate: 'Based on deal status, signals, and risks, generate ONE specific next step.\n\nBe specific: "Schedule technical demo with CTO to address API concerns" not just "Follow up"', outputFormat: 'Next action' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
  // ========== ADDITIONAL SALES WORKFLOWS ==========
  {
    domainId: null,
    triggerPatterns: ['lead\\s*scor', 'qualify\\s*lead', 'lead\\s*qualification', 'hot\\s*lead'],
    steps: [
      { action: 'extract', description: 'Extract BANT qualification signals', promptTemplate: 'Extract BANT:\n1. Budget: Any budget mention\n2. Authority: Decision maker?\n3. Need: Problem to solve?\n4. Timeline: When implement?\n\nFormat: Budget | Authority | Need | Timeline', outputFormat: 'Budget | Authority | Need | Timeline' },
      { action: 'score', description: 'Score lead quality 1-10', promptTemplate: 'Score based on BANT:\n9-10: All 4 strong (hot)\n7-8: 3 strong (warm)\n5-6: 2 strong (nurture)\n1-4: Cold/unqualified\n\nFormat: [Score]/10 - [Reason]', outputFormat: 'Score/10 - Reason' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.85, isBase: true,
  },
  // ========== SUPPORT TICKET WORKFLOW ==========
  {
    domainId: null,
    triggerPatterns: ['support\\s*ticket', 'help\\s*desk', 'ticket\\s*triage', 'customer\\s*issue'],
    steps: [
      { action: 'classify', description: 'Classify ticket urgency', promptTemplate: 'Urgency:\n- Critical: System down, data loss\n- High: Major feature broken\n- Medium: Workaround exists\n- Low: Question, minor issue', outputFormat: 'Urgency - Reason' },
      { action: 'classify', description: 'Categorize ticket type', promptTemplate: 'Category:\n- Bug, Feature Request, How-To, Account, Integration, Other', outputFormat: 'Category' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.85, isBase: true,
  },
  // ========== RESUME SCREENING WORKFLOW ==========
  {
    domainId: null,
    triggerPatterns: ['resume\\s*screen', 'cv\\s*review', 'candidate\\s*screen', 'application\\s*review'],
    steps: [
      { action: 'extract', description: 'Extract key qualifications', promptTemplate: 'Extract:\n1. Years Experience\n2. Education\n3. Key Skills (top 3-5)\n4. Current Role\n\nFormat: Years | Education | Skills | Role', outputFormat: 'Years | Education | Skills | Role' },
      { action: 'classify', description: 'Match against requirements', promptTemplate: 'Match level:\n- Strong: Meets all requirements\n- Partial: Meets most\n- Weak: Missing several\n- No Match: Below minimum', outputFormat: 'Match Level - Reason' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.85, isBase: true,
  },
  // ========== EXPENSE CATEGORIZATION WORKFLOW ==========
  {
    domainId: null,
    triggerPatterns: ['expense\\s*categor', 'expense\\s*report', 'categorize\\s*expense'],
    steps: [
      { action: 'classify', description: 'Categorize expense type', promptTemplate: 'Category:\n- Travel, Office, Software, Marketing, Professional, Utilities, Other', outputFormat: 'Category' },
      { action: 'validate', description: 'Flag for review if needed', promptTemplate: 'Flag if: Missing receipt, unusual amount, policy violation\nOK if: Normal, documented\n\nFormat: [Flag/OK] - [Reason]', outputFormat: 'Flag Status - Reason' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
  // ========== FEATURE REQUEST WORKFLOW ==========
  {
    domainId: null,
    triggerPatterns: ['feature\\s*request', 'product\\s*feedback', 'enhancement\\s*request'],
    steps: [
      { action: 'extract', description: 'Extract request details', promptTemplate: 'Extract:\n1. Feature Summary\n2. Use Case/Why needed\n3. User Type\n4. Urgency\n\nFormat: Summary | Use Case | User | Urgency', outputFormat: 'Summary | Use Case | User | Urgency' },
      { action: 'classify', description: 'Categorize and prioritize', promptTemplate: 'Category: Core Feature, Enhancement, Integration, UX, Performance\nPriority: P1 (many users), P2 (some), P3 (few)\n\nFormat: [Category] | [Priority]', outputFormat: 'Category | Priority' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.85, isBase: true,
  },
  // ========== DATA VALIDATION WORKFLOW ==========
  {
    domainId: null,
    triggerPatterns: ['validate\\s*data', 'data\\s*validation', 'check\\s*data', 'verify\\s*data'],
    steps: [
      { action: 'validate', description: 'Check data completeness', promptTemplate: 'Check:\n✓ Required fields present\n✓ No empty critical values\n✓ Consistent formatting\n\nFormat: [Complete/Incomplete] - [Gaps]', outputFormat: 'Complete/Incomplete - Gaps' },
      { action: 'clean', description: 'Suggest corrections', promptTemplate: 'For issues found, suggest corrections.\nFormat: Original | Issue | Suggested', outputFormat: 'Corrections' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
  // ========== GENERAL PURPOSE WORKFLOWS ==========
  {
    domainId: null,
    triggerPatterns: ['summarize', 'summary', 'brief', 'condense', 'tldr'],
    steps: [
      { action: 'summarize', description: 'Create concise summary', promptTemplate: 'Summarize in 1-2 sentences:\n1. Main point\n2. Key conclusion\nBe concise but complete.', outputFormat: 'Summary' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
  {
    domainId: null,
    triggerPatterns: ['translate', 'translation', 'to\\s*(spanish|french|german|chinese)'],
    steps: [
      { action: 'translate', description: 'Translate to target language', promptTemplate: 'Translate accurately. Preserve tone and meaning. If language unclear, translate to English.', outputFormat: 'Translated text' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
  {
    domainId: null,
    triggerPatterns: ['extract\\s*(name|email|phone|date)', 'find\\s*(name|email|phone)', 'entities'],
    steps: [
      { action: 'extract', description: 'Extract entities from text', promptTemplate: 'Extract (if present):\n- Names, Companies, Locations\n- Dates, Emails, Phones, Amounts\n\nFormat: Type: Value | Type: Value', outputFormat: 'Entity extraction' },
    ],
    usageCount: 0, successCount: 0, successRate: 0.9, isBase: true,
  },
];

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Check if cache needs refresh
 */
function isCacheStale(): boolean {
  if (!cacheLastUpdated) return true;
  return Date.now() - cacheLastUpdated.getTime() > CACHE_TTL_MS;
}

/**
 * Refresh cache from database
 */
export async function refreshCache(): Promise<void> {
  try {
    // Load actions
    const { data: actions } = await supabaseAdmin
      .from('workflow_actions')
      .select('*')
      .order('usage_count', { ascending: false });
    
    if (actions && actions.length > 0) {
      actionsCache = actions.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        defaultPromptTemplate: a.default_prompt_template,
        usageCount: a.usage_count,
        successRate: a.success_rate,
        isBase: a.is_base,
      }));
    } else {
      // Use base patterns as fallback
      actionsCache = BASE_ACTIONS.map((a, i) => ({ ...a, id: `base_${i}` }));
    }
    
    // Load domains
    const { data: domains } = await supabaseAdmin
      .from('workflow_domains')
      .select('*')
      .order('usage_count', { ascending: false });
    
    if (domains && domains.length > 0) {
      domainsCache = domains.map(d => ({
        id: d.id,
        name: d.name,
        keywords: d.keywords,
        usageCount: d.usage_count,
        isBase: d.is_base,
      }));
    } else {
      domainsCache = BASE_DOMAINS.map((d, i) => ({ ...d, id: `base_${i}` }));
    }
    
    // Load workflows
    const { data: workflows } = await supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .order('success_rate', { ascending: false })
      .order('usage_count', { ascending: false });
    
    if (workflows && workflows.length > 0) {
      workflowsCache = workflows.map(w => ({
        id: w.id,
        domainId: w.domain_id,
        triggerPatterns: w.trigger_patterns,
        steps: w.steps,
        usageCount: w.usage_count,
        successCount: w.success_count,
        successRate: w.success_rate,
        isBase: w.is_base,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      }));
    } else {
      workflowsCache = BASE_WORKFLOWS.map((w, i) => ({
        ...w,
        id: `base_${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    
    cacheLastUpdated = new Date();
    console.log(`[WorkflowLearning] Cache refreshed: ${actionsCache.length} actions, ${domainsCache.length} domains, ${workflowsCache.length} workflows`);
    
  } catch (error) {
    console.error('[WorkflowLearning] Cache refresh error:', error);
    // Use base patterns on error
    if (actionsCache.length === 0) {
      actionsCache = BASE_ACTIONS.map((a, i) => ({ ...a, id: `base_${i}` }));
    }
    if (domainsCache.length === 0) {
      domainsCache = BASE_DOMAINS.map((d, i) => ({ ...d, id: `base_${i}` }));
    }
    if (workflowsCache.length === 0) {
      workflowsCache = BASE_WORKFLOWS.map((w, i) => ({
        ...w,
        id: `base_${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
  }
}

/**
 * Ensure cache is fresh
 */
async function ensureCache(): Promise<void> {
  if (isCacheStale()) {
    await refreshCache();
  }
}

// ============================================
// GETTERS
// ============================================

/**
 * Get all learned actions
 */
export async function getActions(): Promise<LearnedAction[]> {
  await ensureCache();
  return actionsCache;
}

/**
 * Get action by name
 */
export async function getAction(name: string): Promise<LearnedAction | null> {
  await ensureCache();
  return actionsCache.find(a => a.name === name) || null;
}

/**
 * Get all domains
 */
export async function getDomains(): Promise<LearnedDomain[]> {
  await ensureCache();
  return domainsCache;
}

/**
 * Detect domain from command
 */
export async function detectDomain(command: string): Promise<LearnedDomain | null> {
  await ensureCache();
  
  for (const domain of domainsCache) {
    for (const pattern of domain.keywords) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return domain;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }
  return null;
}

/**
 * Find matching workflow for command
 */
export async function findWorkflow(command: string, domain?: LearnedDomain | null): Promise<LearnedWorkflow | null> {
  await ensureCache();
  
  // Filter by domain if provided
  const candidates = domain 
    ? workflowsCache.filter(w => w.domainId === domain.id || !w.domainId)
    : workflowsCache;
  
  // Sort by success rate * usage count (most successful & used first)
  const sorted = [...candidates].sort((a, b) => {
    const scoreA = a.successRate * Math.log(a.usageCount + 1);
    const scoreB = b.successRate * Math.log(b.usageCount + 1);
    return scoreB - scoreA;
  });
  
  // Find first matching workflow
  for (const workflow of sorted) {
    for (const pattern of workflow.triggerPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return workflow;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }
  
  return null;
}

/**
 * Check if an action name is valid
 */
export async function isValidAction(name: string): Promise<boolean> {
  await ensureCache();
  return actionsCache.some(a => a.name === name);
}

/**
 * Get valid action names
 */
export async function getValidActionNames(): Promise<string[]> {
  await ensureCache();
  return actionsCache.map(a => a.name);
}

// ============================================
// LEARNING (Write operations)
// ============================================

/**
 * Record workflow usage
 */
export async function recordWorkflowUsage(workflowId: string): Promise<void> {
  try {
    await supabaseAdmin.rpc('increment_workflow_usage', { p_workflow_id: workflowId });
  } catch (error) {
    // Non-critical, log and continue
    console.error('[WorkflowLearning] Usage recording error:', error);
  }
}

/**
 * Record workflow feedback
 */
export async function recordFeedback(feedback: WorkflowFeedback): Promise<void> {
  try {
    // Record feedback
    await supabaseAdmin.from('workflow_feedback').insert({
      workflow_id: feedback.workflowId,
      was_accepted: feedback.wasAccepted,
      was_modified: feedback.wasModified,
      final_steps: feedback.finalSteps,
      execution_success: feedback.executionSuccess,
      created_at: new Date().toISOString(),
    });
    
    // Update workflow stats
    if (feedback.wasAccepted && feedback.executionSuccess) {
      await supabaseAdmin.rpc('increment_workflow_success', { p_workflow_id: feedback.workflowId });
    }
    
    // If user modified the workflow significantly, create a new learned pattern
    if (feedback.wasModified && feedback.finalSteps && feedback.finalSteps.length > 0) {
      await maybeCreateNewWorkflow(feedback);
    }
    
  } catch (error) {
    console.error('[WorkflowLearning] Feedback recording error:', error);
  }
}

/**
 * Maybe create a new workflow from user modifications
 */
async function maybeCreateNewWorkflow(feedback: WorkflowFeedback): Promise<void> {
  if (!feedback.finalSteps || feedback.finalSteps.length === 0) return;
  
  try {
    // Check if this pattern already exists (similar steps)
    const stepsHash = JSON.stringify(feedback.finalSteps.map(s => s.action));
    
    const { data: existing } = await supabaseAdmin
      .from('workflow_templates')
      .select('id')
      .eq('steps_hash', stepsHash)
      .limit(1);
    
    if (existing && existing.length > 0) {
      // Similar workflow exists, just increment its success
      return;
    }
    
    // Create new workflow template from user's modification
    await supabaseAdmin.from('workflow_templates').insert({
      domain_id: null,  // Will be detected on next use
      trigger_patterns: [],  // AI will help refine this
      steps: feedback.finalSteps,
      steps_hash: stepsHash,
      usage_count: 1,
      success_count: feedback.executionSuccess ? 1 : 0,
      success_rate: feedback.executionSuccess ? 1.0 : 0.0,
      is_base: false,
      source: 'user_modification',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    console.log('[WorkflowLearning] Created new workflow from user modification');
    
  } catch (error) {
    console.error('[WorkflowLearning] Create workflow error:', error);
  }
}

/**
 * Add a new domain keyword (learned from successful matches)
 */
export async function addDomainKeyword(domainId: string, keyword: string): Promise<void> {
  try {
    await supabaseAdmin.rpc('add_domain_keyword', { 
      p_domain_id: domainId, 
      p_keyword: keyword 
    });
    // Invalidate cache
    cacheLastUpdated = null;
  } catch (error) {
    console.error('[WorkflowLearning] Add keyword error:', error);
  }
}

/**
 * Add a new workflow trigger pattern
 */
export async function addWorkflowTrigger(workflowId: string, pattern: string): Promise<void> {
  try {
    await supabaseAdmin.rpc('add_workflow_trigger', { 
      p_workflow_id: workflowId, 
      p_pattern: pattern 
    });
    // Invalidate cache
    cacheLastUpdated = null;
  } catch (error) {
    console.error('[WorkflowLearning] Add trigger error:', error);
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the learning system
 * Call this on app startup
 */
export async function initializeWorkflowLearning(): Promise<void> {
  console.log('[WorkflowLearning] Initializing...');
  
  try {
    // Check if tables exist by trying to query them
    const { error: actionsError } = await supabaseAdmin
      .from('workflow_actions')
      .select('id')
      .limit(1);
    
    if (actionsError?.code === '42P01') {
      // Table doesn't exist - that's OK, we'll use base patterns
      console.log('[WorkflowLearning] Tables not found, using base patterns');
    }
    
    // Refresh cache
    await refreshCache();
    
    console.log('[WorkflowLearning] Initialized successfully');
  } catch (error) {
    console.error('[WorkflowLearning] Initialization error:', error);
    // Use base patterns on error
    actionsCache = BASE_ACTIONS.map((a, i) => ({ ...a, id: `base_${i}` }));
    domainsCache = BASE_DOMAINS.map((d, i) => ({ ...d, id: `base_${i}` }));
    workflowsCache = BASE_WORKFLOWS.map((w, i) => ({
      ...w,
      id: `base_${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ============================================
// EXPORTS
// ============================================

export const workflowLearning = {
  // Getters
  getActions,
  getAction,
  getDomains,
  detectDomain,
  findWorkflow,
  isValidAction,
  getValidActionNames,
  
  // Learning
  recordWorkflowUsage,
  recordFeedback,
  addDomainKeyword,
  addWorkflowTrigger,
  
  // Cache
  refreshCache,
  
  // Init
  initialize: initializeWorkflowLearning,
};

export default workflowLearning;
