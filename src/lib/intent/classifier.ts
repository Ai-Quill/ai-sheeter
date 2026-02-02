/**
 * Unified Intent Classifier
 * 
 * Replaces scattered hardcoded regex patterns with an AI-driven
 * classification system that uses:
 * 
 * 1. Embedding similarity for fast path (cached intents)
 * 2. AI classification for ambiguous cases
 * 3. Learning loop to improve over time
 * 
 * @version 1.0.0
 * @created 2026-02-02
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { generateEmbedding } from '../ai/embeddings';
import { findSimilarIntent, promoteToCache, recordOutcome } from './cache';
import {
  IntentClassification,
  IntentOutputMode,
  SkillId,
  DataContext,
  AIClassificationParams,
  SKILL_METADATA,
  ALL_SKILL_IDS,
} from './types';
import { SheetActionType } from '../skills/types';

// ============================================
// CONFIGURATION
// ============================================

/** Similarity threshold for cache hits (higher = stricter) */
const CACHE_SIMILARITY_THRESHOLD = 0.85;

/** Minimum confidence to accept AI classification */
const MIN_AI_CONFIDENCE = 0.6;

/** Model used for intent classification - fast and cheap is ideal */
const CLASSIFIER_MODEL = process.env.INTENT_CLASSIFIER_MODEL || 'gpt-5-mini';

// ============================================
// MAIN CLASSIFIER
// ============================================

/**
 * Classify user intent using hybrid approach:
 * 1. Try embedding cache lookup first (fast path)
 * 2. Fall back to AI classification if no cache hit
 * 
 * @param command - User's command
 * @param context - Data context from spreadsheet
 * @returns Classification result with source information
 */
export async function classifyIntent(
  command: string,
  context: DataContext
): Promise<IntentClassification> {
  const startTime = Date.now();
  
  try {
    // Step 1: Generate embedding for the command
    const embedding = await generateEmbedding(command);
    
    // Step 2: Try cache lookup (fast path)
    const cacheResult = await findSimilarIntent(embedding, CACHE_SIMILARITY_THRESHOLD);
    
    if (cacheResult.hit && cacheResult.cachedIntent) {
      console.log(`[Classifier] Cache hit! Similarity: ${cacheResult.similarity?.toFixed(3)}, Command: "${cacheResult.cachedIntent.canonicalCommand}"`);
      
      return {
        ...cacheResult.cachedIntent.intent,
        source: 'cache',
        confidence: cacheResult.similarity || 0.9,
        classificationTimeMs: Date.now() - startTime
      };
    }
    
    console.log('[Classifier] Cache miss, falling back to AI classification');
    
    // Step 3: AI classification (slow path)
    const aiResult = await classifyWithAI({ command, context });
    
    return {
      ...aiResult,
      source: 'ai',
      classificationTimeMs: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('[Classifier] Error during classification:', error);
    
    // Fallback: Use heuristic classification
    return {
      ...classifyWithHeuristics(command),
      source: 'fallback',
      classificationTimeMs: Date.now() - startTime
    };
  }
}

// ============================================
// AI CLASSIFICATION
// ============================================

/**
 * Classify intent using AI
 * Uses a lightweight classification prompt (~200 tokens)
 */
async function classifyWithAI(params: AIClassificationParams): Promise<IntentClassification> {
  const { command, context } = params;
  
  // Build the classification prompt
  const prompt = buildClassificationPrompt(command, context);
  
  try {
    // Use OpenAI for classification (fast and cheap)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY required for AI classification');
    }
    
    const openai = createOpenAI({ apiKey });
    const model = openai(CLASSIFIER_MODEL);
    
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.1, // Low temperature for consistent classification
    });
    
    // Parse the response
    const classification = parseClassificationResponse(text);
    
    console.log(`[Classifier] AI classification: ${classification.outputMode} / ${classification.skillId} (confidence: ${classification.confidence})`);
    
    return classification;
    
  } catch (error) {
    console.error('[Classifier] AI classification failed:', error);
    throw error;
  }
}

/**
 * Build the classification prompt
 */
function buildClassificationPrompt(command: string, context: DataContext): string {
  // Build context summary
  const contextSummary = buildContextSummary(context);
  
  // Build skill list
  const skillList = ALL_SKILL_IDS
    .map(id => `${id}: ${SKILL_METADATA[id].description}`)
    .join('\n');
  
  return `Classify this Google Sheets command into the correct category.

COMMAND: "${command}"

DATA CONTEXT:
${contextSummary}

AVAILABLE SKILLS:
${skillList}

INSTRUCTIONS:
1. Determine the outputMode:
   - "sheet": Direct action on spreadsheet (format, chart, filter, validation, etc.)
   - "chat": Question or request for information
   - "formula": Simple text operation (translate, uppercase, extract)
   - "workflow": Complex multi-step operation

2. Determine the skillId (for sheet/formula modes):
   - Match to one of: ${ALL_SKILL_IDS.join(', ')}
   - Use "chat" for questions

3. For sheet actions, determine sheetAction type.

RESPOND WITH ONLY JSON (no markdown):
{
  "outputMode": "sheet|chat|formula|workflow",
  "skillId": "format|chart|...|null",
  "sheetAction": "format|chart|...|null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
}

/**
 * Build a summary of the data context
 */
function buildContextSummary(context: DataContext): string {
  const parts: string[] = [];
  
  if (context.dataColumns.length > 0) {
    parts.push(`Columns: ${context.dataColumns.join(', ')}`);
  }
  
  if (Object.keys(context.headers).length > 0) {
    const headerList = Object.entries(context.headers)
      .map(([col, name]) => `${col}="${name}"`)
      .slice(0, 5)
      .join(', ');
    parts.push(`Headers: ${headerList}`);
  }
  
  if (context.rowCount) {
    parts.push(`Rows: ${context.rowCount}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : 'No specific context provided';
}

/**
 * Parse the AI classification response
 */
function parseClassificationResponse(text: string): IntentClassification {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize
    const outputMode = validateOutputMode(parsed.outputMode);
    const skillId = validateSkillId(parsed.skillId);
    const sheetAction = validateSheetAction(parsed.sheetAction);
    const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.7));
    
    return {
      outputMode,
      skillId,
      sheetAction,
      confidence,
      reasoning: parsed.reasoning,
      source: 'ai'
    };
    
  } catch (error) {
    console.error('[Classifier] Failed to parse AI response:', text, error);
    
    // Return a safe fallback
    return {
      outputMode: 'chat',
      skillId: 'chat',
      confidence: 0.5,
      source: 'ai',
      reasoning: 'Failed to parse AI response'
    };
  }
}

/**
 * Validate output mode
 */
function validateOutputMode(mode: string): IntentOutputMode {
  const validModes: IntentOutputMode[] = ['sheet', 'chat', 'formula', 'workflow', 'columns'];
  return validModes.includes(mode as IntentOutputMode) 
    ? (mode as IntentOutputMode) 
    : 'chat';
}

/**
 * Validate skill ID
 */
function validateSkillId(skillId: string | null): SkillId | null {
  if (!skillId) return null;
  return ALL_SKILL_IDS.includes(skillId as SkillId) 
    ? (skillId as SkillId) 
    : null;
}

/**
 * Validate sheet action type
 */
function validateSheetAction(action: string | null): SheetActionType | undefined {
  if (!action) return undefined;
  const validActions: SheetActionType[] = [
    'chart', 'format', 'conditionalFormat', 'dataValidation',
    'filter', 'writeData', 'createTable', 'sheetOps'
  ];
  return validActions.includes(action as SheetActionType) 
    ? (action as SheetActionType) 
    : undefined;
}

// ============================================
// HEURISTIC FALLBACK
// ============================================

/**
 * Simple heuristic classification when AI is unavailable
 * This is the minimal fallback to ensure the system always works
 */
function classifyWithHeuristics(command: string): IntentClassification {
  const cmdLower = command.toLowerCase();
  
  // Check for pasted table data (markdown pattern)
  if (/\|.*\|.*\|/.test(command)) {
    return {
      outputMode: 'sheet',
      skillId: 'writeData',
      sheetAction: 'writeData',
      confidence: 0.9,
      source: 'fallback',
      reasoning: 'Detected markdown table pattern'
    };
  }
  
  // Check for "create table" with data patterns
  // Covers: "create table for/from/based on this data", "help me create a table", etc.
  if (/\bcreate\s+(a\s+)?table\b/i.test(cmdLower) || 
      /\btable\s+(for|from|based on|with)\s+(this\s+)?data\b/i.test(cmdLower) ||
      (/\bdata\s*:/i.test(cmdLower) && /,/.test(command))) {
    return {
      outputMode: 'sheet',
      skillId: 'writeData',
      sheetAction: 'writeData',
      confidence: 0.85,
      source: 'fallback',
      reasoning: 'Detected create table / data import pattern'
    };
  }
  
  // Check for questions
  if (/\b(what|which|who|how many|summarize|explain)\b/i.test(cmdLower) && /\?/.test(command)) {
    return {
      outputMode: 'chat',
      skillId: 'chat',
      confidence: 0.8,
      source: 'fallback',
      reasoning: 'Detected question pattern'
    };
  }
  
  // Check for chart keywords
  if (/\b(chart|graph|plot|pie|bar|line|visualize)\b/i.test(cmdLower)) {
    return {
      outputMode: 'sheet',
      skillId: 'chart',
      sheetAction: 'chart',
      confidence: 0.7,
      source: 'fallback',
      reasoning: 'Detected chart keywords'
    };
  }
  
  // Check for format keywords
  if (/\b(format|bold|italic|currency|percent|border|align)\b/i.test(cmdLower)) {
    return {
      outputMode: 'sheet',
      skillId: 'format',
      sheetAction: 'format',
      confidence: 0.7,
      source: 'fallback',
      reasoning: 'Detected format keywords'
    };
  }
  
  // Check for translation/formula keywords
  if (/\b(translate|uppercase|lowercase|trim|extract)\b/i.test(cmdLower)) {
    return {
      outputMode: 'formula',
      skillId: 'formula',
      confidence: 0.7,
      source: 'fallback',
      reasoning: 'Detected formula keywords'
    };
  }
  
  // Default to chat for unknown commands
  return {
    outputMode: 'chat',
    skillId: 'chat',
    confidence: 0.5,
    source: 'fallback',
    reasoning: 'No specific pattern matched, defaulting to chat'
  };
}

// ============================================
// LEARNING LOOP
// ============================================

/**
 * Record the outcome of a classification for learning
 * 
 * @param params - Classification outcome parameters
 */
export async function learnFromOutcome(params: {
  command: string;
  classification: IntentClassification;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  const { command, classification, success, errorMessage } = params;
  
  try {
    // Generate embedding for the command
    const embedding = await generateEmbedding(command);
    
    // Record the outcome
    await recordOutcome({
      command,
      embedding,
      classification,
      source: classification.source,
      success,
      errorMessage,
      classificationTimeMs: classification.classificationTimeMs
    });
    
    // If successful and from AI, consider promoting to cache
    if (success && classification.source === 'ai' && classification.confidence >= 0.8) {
      console.log(`[Classifier] Promoting successful AI classification to cache: "${command}"`);
      await promoteToCache(
        command,
        embedding,
        classification,
        classification.skillId || undefined
      );
    }
    
  } catch (error) {
    // Non-fatal, just log
    console.warn('[Classifier] Failed to record learning outcome:', error);
  }
}

// ============================================
// UTILITY EXPORTS
// ============================================

export { 
  CACHE_SIMILARITY_THRESHOLD,
  MIN_AI_CONFIDENCE,
  classifyWithHeuristics as fallbackClassify 
};
