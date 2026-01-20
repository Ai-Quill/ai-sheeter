/**
 * Embedding Service
 * 
 * Generates text embeddings for semantic search and similarity matching.
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions).
 * 
 * Cost: ~$0.00002 per request (negligible)
 * 
 * @version 1.0.0
 * @updated 2026-01-20
 */

import OpenAI from 'openai';

// Singleton OpenAI client for embeddings
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embedding generation');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate embedding for a text string
 * 
 * @param text - The text to embed
 * @returns Vector of 1536 floats
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  
  // Normalize and truncate text (model has 8192 token limit)
  const normalizedText = text
    .trim()
    .toLowerCase()
    .slice(0, 8000); // Safe limit
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: normalizedText,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient for multiple texts
 * 
 * @param texts - Array of texts to embed
 * @returns Array of embeddings (same order as input)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAIClient();
  
  const normalizedTexts = texts.map(text => 
    text.trim().toLowerCase().slice(0, 8000)
  );
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: normalizedTexts,
    });
    
    // Sort by index to maintain order
    return response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  } catch (error) {
    console.error('[Embeddings] Error generating batch embeddings:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * 
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

// Export dimension for reference
export const EMBEDDING_DIMENSION = 1536;
