/**
 * @file /api/agent/suggestions
 * @version 1.0.0
 * @updated 2026-01-21
 * 
 * ============================================
 * DYNAMIC SUGGESTIONS API
 * ============================================
 * 
 * Provides contextual suggestions after task/chain completion.
 * Uses semantic search to find similar workflows and their successful suggestions.
 * Falls back to LLM-generated suggestions when no matches found.
 * 
 * This replaces hardcoded frontend suggestions with a learning system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarWorkflowsByEmbedding, StoredWorkflow } from '@/lib/workflow-memory';
import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

interface SuggestionsRequest {
  // Chain task context
  steps?: Array<{
    action: string;
    description: string;
    outputFormat?: string;
  }>;
  
  // Single task context
  taskType?: string;
  taskDescription?: string;
  
  // Common context
  dataContext?: {
    columns?: string[];
    headers?: Record<string, string>;
    rowCount?: number;
    sampleData?: Record<string, string[]>;
  };
  command?: string;
  
  // Optional: workflow ID for recording successes
  workflowId?: string;
}

interface Suggestion {
  icon: string;
  title: string;
  command: string;
  reason: string;
  confidence?: number;
}

interface SuggestionInsight {
  icon: string;
  message: string;
  tip: string | null;
}

interface SuggestionsResponse {
  domain: string | null;
  domainLabel: string;
  insight: SuggestionInsight;
  suggestions: Suggestion[];
  source: 'memory' | 'llm' | 'fallback';
  workflowId?: string;
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: SuggestionsRequest = await request.json();
    
    console.log('[suggestions] Request received:', {
      hasSteps: !!body.steps?.length,
      hasTaskType: !!body.taskType,
      hasCommand: !!body.command,
    });
    
    // Build summary text from the request
    const summaryText = buildSummaryText(body);
    
    if (!summaryText) {
      return NextResponse.json({
        domain: null,
        domainLabel: 'General',
        insight: {
          icon: '✅',
          message: 'Task completed',
          tip: null,
        },
        suggestions: getGenericFallbackSuggestions(body.dataContext),
        source: 'fallback' as const,
      });
    }
    
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(summaryText);
    
    // Search for similar workflows
    const similarWorkflows = await findSimilarWorkflowsByEmbedding(
      embedding,
      5, // Get more to find ones with suggestions
      0.65 // Slightly lower threshold to find more matches
    );
    
    console.log('[suggestions] Found', similarWorkflows.length, 'similar workflows');
    
    // Try to get suggestions from memory first
    const memoryResult = await getSuggestionsFromMemory(similarWorkflows, body);
    
    if (memoryResult) {
      console.log('[suggestions] Using memory-based suggestions');
      return NextResponse.json({
        ...memoryResult,
        source: 'memory' as const,
      });
    }
    
    // Fallback: Generate with LLM
    console.log('[suggestions] Falling back to LLM generation');
    const llmResult = await generateSuggestionsWithLLM(summaryText, body, similarWorkflows);
    
    if (llmResult) {
      return NextResponse.json({
        ...llmResult,
        source: 'llm' as const,
      });
    }
    
    // Last resort: generic fallback
    console.log('[suggestions] Using generic fallback');
    return NextResponse.json({
      domain: null,
      domainLabel: 'General',
      insight: {
        icon: '✅',
        message: 'Task completed successfully',
        tip: null,
      },
      suggestions: getGenericFallbackSuggestions(body.dataContext),
      source: 'fallback' as const,
    });
    
  } catch (error) {
    console.error('[suggestions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

// ============================================
// RECORD SUCCESS ENDPOINT
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, suggestion, success } = body;
    
    if (!workflowId || !suggestion) {
      return NextResponse.json({ error: 'workflowId and suggestion required' }, { status: 400 });
    }
    
    // Record successful suggestion
    if (success) {
      const { error } = await supabaseAdmin.rpc('record_successful_suggestion', {
        p_workflow_id: workflowId,
        p_suggestion: {
          ...suggestion,
          recorded_at: new Date().toISOString(),
        },
      });
      
      if (error) {
        console.error('[suggestions] Error recording success:', error);
        // Don't fail - this is non-critical
      } else {
        console.log('[suggestions] Recorded successful suggestion for workflow:', workflowId);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[suggestions] Error recording:', error);
    return NextResponse.json({ error: 'Failed to record suggestion' }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a summary text from the request for embedding
 */
function buildSummaryText(body: SuggestionsRequest): string {
  const parts: string[] = [];
  
  if (body.command) {
    parts.push(body.command);
  }
  
  if (body.steps?.length) {
    const stepSummary = body.steps
      .map((s, i) => `Step ${i + 1}: ${s.action} - ${s.description}`)
      .join('. ');
    parts.push(stepSummary);
  }
  
  if (body.taskType && body.taskDescription) {
    parts.push(`${body.taskType}: ${body.taskDescription}`);
  }
  
  // Add data context hints
  if (body.dataContext?.headers) {
    const headerNames = Object.values(body.dataContext.headers).join(', ');
    if (headerNames) {
      parts.push(`Data columns: ${headerNames}`);
    }
  }
  
  return parts.join(' | ');
}

/**
 * Try to get suggestions from similar workflows in memory
 */
async function getSuggestionsFromMemory(
  similarWorkflows: StoredWorkflow[],
  body: SuggestionsRequest
): Promise<Omit<SuggestionsResponse, 'source'> | null> {
  // Look for workflows that have successful_suggestions
  for (const workflow of similarWorkflows) {
    try {
      // Fetch the full workflow with suggestions
      const { data, error } = await supabaseAdmin
        .from('workflow_memory')
        .select('successful_suggestions, domain, task_insight')
        .eq('id', workflow.id)
        .single();
      
      if (error || !data) continue;
      
      const suggestions = data.successful_suggestions as Suggestion[] | null;
      
      if (suggestions && suggestions.length >= 2) {
        // We found a workflow with successful suggestions
        const domain = data.domain || workflow.domain;
        
        return {
          domain,
          domainLabel: getDomainLabel(domain),
          insight: data.task_insight || getInsightForDomain(domain, body),
          suggestions: suggestions.slice(0, 3),
          workflowId: workflow.id,
        };
      }
    } catch (e) {
      console.error('[suggestions] Error fetching workflow details:', e);
      continue;
    }
  }
  
  // If we have similar workflows but no suggestions, try to infer domain
  if (similarWorkflows.length > 0) {
    const topMatch = similarWorkflows[0];
    const domain = topMatch.domain;
    
    if (domain) {
      // We know the domain, but no suggestions - generate based on domain
      return null; // Let LLM generate
    }
  }
  
  return null;
}

/**
 * Generate suggestions using LLM when no memory matches
 */
async function generateSuggestionsWithLLM(
  summaryText: string,
  body: SuggestionsRequest,
  similarWorkflows: StoredWorkflow[]
): Promise<Omit<SuggestionsResponse, 'source'> | null> {
  try {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    
    // Build context from steps or task
    const contextParts: string[] = [];
    
    if (body.steps?.length) {
      contextParts.push('Completed workflow steps:');
      body.steps.forEach((s, i) => {
        contextParts.push(`${i + 1}. ${s.action}: ${s.description}`);
        if (s.outputFormat) contextParts.push(`   Output: ${s.outputFormat}`);
      });
    }
    
    if (body.taskType) {
      contextParts.push(`Task type: ${body.taskType}`);
      if (body.taskDescription) {
        contextParts.push(`Task description: ${body.taskDescription}`);
      }
    }
    
    if (body.dataContext?.headers) {
      contextParts.push(`Data columns: ${Object.values(body.dataContext.headers).join(', ')}`);
    }
    
    if (body.dataContext?.rowCount) {
      contextParts.push(`Row count: ${body.dataContext.rowCount}`);
    }
    
    // Build prompt
    const prompt = `You are an AI assistant helping users work with spreadsheet data. A user just completed a task and needs suggestions for what to do next.

${contextParts.join('\n')}

Original command: ${body.command || 'Not provided'}

Based on this completed task, suggest 3 logical next actions the user might want to take. Focus on actions that:
1. Build on the results just generated
2. Are commonly done after this type of task
3. Would provide additional value from the data

IMPORTANT: Generate suggestions that make sense for spreadsheet data operations like: summarize, analyze patterns, create reports, export data, filter results, combine with other data, etc.

Respond in JSON format only:
{
  "domain": "detected domain (e.g., sales, hr, customer_feedback, product, marketing, or null)",
  "domainLabel": "Human readable label (e.g., Sales Intelligence, HR Analytics)",
  "insight": {
    "icon": "emoji that represents the domain",
    "message": "Brief encouraging message about what was accomplished (under 60 chars)",
    "tip": "Optional helpful tip or null"
  },
  "suggestions": [
    {
      "icon": "emoji",
      "title": "Short action title (under 30 chars)",
      "command": "The actual command the user would type",
      "reason": "Why this is useful (under 50 chars)"
    }
  ]
}`;

    const result = await generateText({
      model: openai('gpt-5-mini'),
      prompt,
      maxOutputTokens: 800,
    });
    
    // Parse the response
    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        domain: parsed.domain || null,
        domainLabel: parsed.domainLabel || 'General',
        insight: parsed.insight || {
          icon: '✅',
          message: 'Task completed',
          tip: null,
        },
        suggestions: (parsed.suggestions || []).slice(0, 3),
      };
    }
    
  } catch (error) {
    console.error('[suggestions] LLM generation error:', error);
  }
  
  return null;
}

/**
 * Get domain label from domain string
 */
function getDomainLabel(domain: string | null): string {
  if (!domain) return 'General';
  
  const labels: Record<string, string> = {
    sales: 'Sales Intelligence',
    hr: 'HR Analytics',
    customer_feedback: 'Customer Insights',
    product: 'Product Analytics',
    marketing: 'Marketing Analytics',
    finance: 'Financial Analysis',
    operations: 'Operations',
    research: 'Research',
    content: 'Content Analysis',
    data_quality: 'Data Quality',
  };
  
  return labels[domain.toLowerCase()] || domain;
}

/**
 * Get insight for a domain
 */
function getInsightForDomain(
  domain: string | null,
  body: SuggestionsRequest
): SuggestionInsight {
  const rowCount = body.dataContext?.rowCount || 0;
  const stepCount = body.steps?.length || 0;
  
  if (!domain) {
    return {
      icon: '✅',
      message: rowCount ? `Processed ${rowCount} rows` : 'Task completed',
      tip: null,
    };
  }
  
  // Domain-specific insights
  const insights: Record<string, SuggestionInsight> = {
    sales: {
      icon: '💼',
      message: `${rowCount} deals analyzed`,
      tip: 'Review high-value opportunities first',
    },
    hr: {
      icon: '👥',
      message: `${rowCount} candidates processed`,
      tip: 'Export shortlist for review',
    },
    customer_feedback: {
      icon: '💬',
      message: `${rowCount} responses analyzed`,
      tip: 'Look for recurring themes',
    },
    product: {
      icon: '📦',
      message: `${rowCount} items processed`,
      tip: 'Group by category for insights',
    },
    marketing: {
      icon: '📢',
      message: `${rowCount} entries analyzed`,
      tip: 'Compare performance across channels',
    },
  };
  
  return insights[domain.toLowerCase()] || {
    icon: '✅',
    message: rowCount ? `Processed ${rowCount} rows` : 'Task completed',
    tip: null,
  };
}

/**
 * Generic fallback suggestions (minimal hardcoding - only for last resort)
 */
function getGenericFallbackSuggestions(
  dataContext?: SuggestionsRequest['dataContext']
): Suggestion[] {
  const columns = dataContext?.columns || ['A', 'B'];
  const firstCol = columns[0] || 'A';
  const lastCol = columns[columns.length - 1] || 'B';
  
  return [
    {
      icon: '📊',
      title: 'Summarize findings',
      command: `Summarize key insights from columns ${firstCol} to ${lastCol}`,
      reason: 'Get a quick overview',
    },
    {
      icon: '🔍',
      title: 'Analyze patterns',
      command: `What patterns exist in this data?`,
      reason: 'Discover hidden insights',
    },
    {
      icon: '📝',
      title: 'Create report',
      command: `Create an executive summary of the results`,
      reason: 'Share your findings',
    },
  ];
}
