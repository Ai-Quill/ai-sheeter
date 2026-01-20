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

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarWorkflowsByEmbedding, StoredWorkflow } from '@/lib/workflow-memory';
import { supabaseAdmin } from '@/lib/supabase';
import { AIProvider } from '@/lib/ai/models';
import { authenticateRequestOptional } from '@/lib/auth/auth-service';

// Extended timeout for suggestions - includes embedding + LLM inference
export const maxDuration = 30;

// ============================================
// TYPES
// ============================================

interface SuggestionsRequest {
  // Chain task context
  steps?: Array<{
    action: string;
    description: string;
    outputFormat?: string;
    inputColumns?: string[];
    outputColumn?: string;
    prompt?: string;
  }>;
  
  // Single task context
  taskType?: string;
  taskDescription?: string;
  
  // Common context
  dataContext?: {
    columns?: string[];
    inputColumns?: string[];
    outputColumns?: string[];
    headers?: Record<string, string>;
    rowCount?: number;
    sampleData?: Record<string, string[]>;
  };
  command?: string;
  summary?: string;  // Workflow summary
  
  // User's AI model choice (use same model they selected)
  provider?: AIProvider;
  encryptedApiKey?: string;  // Encrypted API key - backend decrypts
  
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
    
    // Authenticate request - API key is optional for suggestions (falls back to generic)
    const auth = authenticateRequestOptional(body);
    const { provider, apiKey, model } = auth;
    
    console.log('[suggestions] Request received:', {
      hasSteps: !!body.steps?.length,
      hasTaskType: !!body.taskType,
      hasCommand: !!body.command,
      provider: provider,
      hasApiKey: !!apiKey,
      hasModel: !!model,
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
    
    // Fallback: Generate with LLM using user's selected model
    console.log('[suggestions] Falling back to LLM generation');
    const llmResult = await generateSuggestionsWithLLM(
      summaryText, 
      body, 
      similarWorkflows,
      model  // Model from authenticateRequestOptional
    );
    
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
 * @param model - Pre-configured model from authenticateRequestOptional
 */
async function generateSuggestionsWithLLM(
  summaryText: string,
  body: SuggestionsRequest,
  similarWorkflows: StoredWorkflow[],
  model?: import('ai').LanguageModel
): Promise<Omit<SuggestionsResponse, 'source'> | null> {
  try {
    // Use user's model if provided, otherwise skip LLM (rely on fallback)
    if (!model) {
      console.log('[suggestions] No model provided, skipping LLM generation');
      return null;
    }
    
    console.log('[suggestions] Using authenticated model for suggestions');
    console.log('[suggestions] Model type:', typeof model);
    console.log('[suggestions] Model keys:', Object.keys(model || {}));
    
    // Build rich context from steps or task
    const contextParts: string[] = [];
    
    // Log received context for debugging
    console.log('[suggestions] Building context from:', {
      stepsCount: body.steps?.length || 0,
      taskType: body.taskType,
      command: body.command?.substring(0, 50),
      summary: body.summary?.substring(0, 50),
      hasDataContext: !!body.dataContext,
      hasSampleData: !!body.dataContext?.sampleData,
    });
    
    if (body.steps?.length) {
      contextParts.push('## Completed Workflow Steps:');
      body.steps.forEach((s, i) => {
        contextParts.push(`${i + 1}. **${s.action}**: ${s.description}`);
        if (s.inputColumns?.length) contextParts.push(`   Input columns: ${s.inputColumns.join(', ')}`);
        if (s.outputColumn) contextParts.push(`   Output column: ${s.outputColumn}`);
        if (s.prompt) contextParts.push(`   Prompt: "${s.prompt.substring(0, 100)}..."`);
      });
    }
    
    if (body.taskType) {
      contextParts.push(`\n## Task Type: ${body.taskType}`);
      if (body.taskDescription) {
        contextParts.push(`Task description: ${body.taskDescription}`);
      }
    }
    
    if (body.summary) {
      contextParts.push(`\n## Workflow Summary: ${body.summary}`);
    }
    
    // Data context
    if (body.dataContext) {
      contextParts.push('\n## Data Context:');
      if (body.dataContext.inputColumns?.length) {
        contextParts.push(`Input columns: ${body.dataContext.inputColumns.join(', ')}`);
      }
      if (body.dataContext.outputColumns?.length) {
        contextParts.push(`Output columns: ${body.dataContext.outputColumns.join(', ')}`);
      }
      if (body.dataContext.headers && Object.keys(body.dataContext.headers).length > 0) {
        const headerList = Object.entries(body.dataContext.headers)
          .map(([col, name]) => `${col}: "${name}"`)
          .join(', ');
        contextParts.push(`Column headers: ${headerList}`);
      }
      if (body.dataContext.rowCount) {
        contextParts.push(`Rows processed: ${body.dataContext.rowCount}`);
      }
      
      // Include sample data if available
      if (body.dataContext.sampleData && Object.keys(body.dataContext.sampleData).length > 0) {
        contextParts.push('\n## Sample Data:');
        Object.entries(body.dataContext.sampleData).forEach(([col, samples]) => {
          if (Array.isArray(samples) && samples.length > 0) {
            contextParts.push(`Column ${col}: ${samples.slice(0, 2).map(s => `"${String(s).substring(0, 50)}"`).join(', ')}`);
          }
        });
      }
    }
    
    // Build prompt with rich context
    const contextText = contextParts.length > 0 ? contextParts.join('\n') : 'No specific context available';
    
    const prompt = `You are a helpful AI assistant for a Google Sheets automation tool. A user just completed a data processing task and needs smart suggestions for what to do next.

# What the user just did:
${contextText}

# Original user command:
"${body.command || body.taskDescription || 'Process data'}"

# Your task:
Suggest exactly 3 logical next actions. These should:
1. Build on the results just generated (use the output columns mentioned above)
2. Be commonly useful after this type of task
3. Provide additional value from the processed data

Think about what a data analyst would naturally do next after this type of analysis.

# Response format (JSON only, no markdown):
{"domain":"sales","domainLabel":"Sales Intelligence","insight":{"icon":"📊","message":"Pipeline analysis complete for 8 deals","tip":"Results in columns G, H, I"},"suggestions":[{"icon":"📈","title":"Summarize key findings","command":"Summarize the key patterns and trends from columns G to I","reason":"Get executive overview"},{"icon":"🎯","title":"Identify top opportunities","command":"From the analysis results, identify the top 3 deals most likely to close","reason":"Focus on winners"},{"icon":"📋","title":"Create action report","command":"Create a brief report of recommended next steps for each deal","reason":"Actionable insights"}]}`;
    
    console.log('[suggestions] Prompt length:', prompt.length);
    console.log('[suggestions] Context parts count:', contextParts.length);

    console.log('[suggestions] Calling generateText...');
    let result;
    try {
      result = await generateText({
        model,
        prompt,
        maxOutputTokens: 1500,  // Increased from 800 - JSON responses need more space
        temperature: 0.7,  // Add some creativity for suggestions
      });
    } catch (genError) {
      console.error('[suggestions] generateText failed:', genError instanceof Error ? genError.message : genError);
      console.error('[suggestions] generateText error stack:', genError instanceof Error ? genError.stack : 'N/A');
      throw genError; // re-throw to hit outer catch
    }
    
    // Parse the response
    const text = result.text?.trim() || '';
    console.log('[suggestions] LLM response length:', text.length);
    console.log('[suggestions] LLM response preview:', text.substring(0, 300));
    console.log('[suggestions] LLM full response:', text);  // Log full response for debugging
    console.log('[suggestions] Result keys:', Object.keys(result));
    console.log('[suggestions] Finish reason:', result.finishReason);
    console.log('[suggestions] Usage:', JSON.stringify(result.usage));
    
    // Try to find complete JSON first
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    
    // If no complete JSON found, try to fix truncated JSON
    if (!jsonMatch && text.includes('{')) {
      console.log('[suggestions] Attempting to fix truncated JSON...');
      // Count open braces and add closing braces
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      const missingBraces = openBraces - closeBraces;
      
      if (missingBraces > 0) {
        // Try to fix by closing arrays and objects
        let fixedText = text;
        // Close any open strings
        if ((fixedText.match(/"/g) || []).length % 2 !== 0) {
          fixedText += '"';
        }
        // Close any open arrays
        const openArrays = (fixedText.match(/\[/g) || []).length;
        const closeArrays = (fixedText.match(/\]/g) || []).length;
        fixedText += ']'.repeat(Math.max(0, openArrays - closeArrays));
        // Close remaining braces
        fixedText += '}'.repeat(missingBraces);
        console.log('[suggestions] Fixed JSON attempt:', fixedText.substring(0, 300));
        jsonMatch = fixedText.match(/\{[\s\S]*\}/);
      }
    }
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[suggestions] Parsed LLM response successfully');
        
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
      } catch (parseError) {
        console.error('[suggestions] JSON parse error:', parseError);
        console.error('[suggestions] Failed JSON:', jsonMatch[0].substring(0, 300));
      }
    } else {
      console.error('[suggestions] No JSON found in LLM response');
    }
    
  } catch (error) {
    console.error('[suggestions] LLM generation error:', error instanceof Error ? error.message : error);
  }
  
  console.log('[suggestions] Using generic fallback');
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
