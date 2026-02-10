/**
 * AI Model Factory - Unified provider interface via Vercel AI SDK
 * 
 * Replaces 4 separate SDKs with one unified API:
 * - openai → @ai-sdk/openai
 * - @anthropic-ai/sdk → @ai-sdk/anthropic  
 * - @google/generative-ai → @ai-sdk/google
 * - groq-sdk → @ai-sdk/openai (OpenAI-compatible)
 * 
 * @see https://ai-sdk.dev/docs/introduction
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// Provider type for our system
export type AIProvider = 'CHATGPT' | 'CLAUDE' | 'GROQ' | 'GEMINI' | 'STRATICO';

// Model configuration
export interface ModelConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
}

/**
 * Creates a unified language model instance for any supported provider
 * 
 * @example
 * const model = getModel('CLAUDE', 'claude-haiku-4-5', apiKey);
 * const { text } = await generateText({ model, prompt: 'Hello' });
 */
export function getModel(
  provider: AIProvider,
  modelId: string,
  apiKey: string
): LanguageModel {
  switch (provider) {
    case 'CHATGPT':
      return createOpenAI({ apiKey })(modelId);

    case 'CLAUDE':
      return createAnthropic({ apiKey })(modelId);

    case 'GEMINI':
      return createGoogleGenerativeAI({ apiKey })(modelId);

    case 'GROQ':
      // Groq uses OpenAI-compatible API
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      })(modelId);

    case 'STRATICO':
      // Stratico uses OpenAI-compatible API
      return createOpenAI({
        apiKey,
        baseURL: 'https://api.stratico.com/v1',
      })(modelId);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Default models for each provider (cost-optimized for spreadsheet tasks)
 * @see docs/research/models.md for full pricing table
 */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  CHATGPT: 'gpt-5-mini',           // $0.25/$2.00 per MTok
  CLAUDE: 'claude-haiku-4-5',      // $1.00/$5.00 per MTok
  GROQ: 'llama-3.3-70b-versatile', // $0.59/$0.79 per MTok
  GEMINI: 'gemini-2.5-flash',      // $0.075/$0.30 per MTok
  STRATICO: 'gpt-5-mini',           // Fallback
};

/**
 * Get the default model for a provider
 */
export function getDefaultModel(provider: AIProvider): string {
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.CHATGPT;
}
