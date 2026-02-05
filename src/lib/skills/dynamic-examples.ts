/**
 * Dynamic Skill Examples
 * 
 * DEPRECATED: This module is disabled.
 * Modern LLMs handle intent from skill instructions alone.
 * 
 * Kept for potential future use if example-based learning is needed.
 * 
 * @version 2.0.0 - Disabled
 * @created 2026-02-01
 * @deprecated 2026-02-05
 */

import { SkillExample } from './types';

/**
 * Extended skill example with similarity metadata
 */
export interface DynamicSkillExample extends SkillExample {
  similarity: number;
  qualityScore: number;
  source: 'database' | 'hardcoded';
}

/**
 * Load dynamic examples for a skill from the database
 * 
 * DISABLED: Returns empty array. AI uses skill instructions alone.
 */
export async function loadDynamicExamples(
  skillId: string,
  command: string,
  maxExamples: number = 2,
  similarityThreshold: number = 0.5
): Promise<DynamicSkillExample[]> {
  // DISABLED - trusting AI with instructions
  return [];
}

/**
 * Mark a successful execution as a good example
 * DISABLED: No-op
 */
export async function markAsGoodExample(
  usageId: string,
  qualityScore: number = 0.8
): Promise<boolean> {
  return false;
}

/**
 * Get count of dynamic examples per skill
 * DISABLED: Returns empty object
 */
export async function getExampleCounts(): Promise<Record<string, number>> {
  return {};
}

/**
 * Convert hardcoded examples to dynamic format
 */
export function convertHardcodedExamples(
  examples: SkillExample[]
): DynamicSkillExample[] {
  return examples.map(ex => ({
    ...ex,
    similarity: 1.0,
    qualityScore: 0.9,
    source: 'hardcoded' as const
  }));
}

/**
 * Score hardcoded example by keyword relevance
 */
export function scoreHardcodedExample(
  example: SkillExample,
  command: string
): number {
  const commandLower = command.toLowerCase();
  const exampleLower = example.command.toLowerCase();
  
  if (commandLower === exampleLower) return 1.0;
  
  const commandWords = new Set(commandLower.split(/\s+/));
  const exampleWords = exampleLower.split(/\s+/);
  
  let matchCount = 0;
  for (const word of exampleWords) {
    if (commandWords.has(word)) matchCount++;
  }
  
  return exampleWords.length > 0 ? matchCount / exampleWords.length : 0;
}
