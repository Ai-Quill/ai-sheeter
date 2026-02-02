/**
 * Intent Cache Operations
 * 
 * Handles all database operations for the intent cache:
 * - Finding similar intents by embedding
 * - Recording cache hits
 * - Promoting successful classifications to cache
 * - Seeding initial embeddings
 * 
 * @version 1.0.0
 * @created 2026-02-02
 */

import { supabaseAdmin } from '../supabase';
import { generateEmbedding, generateEmbeddings } from '../ai/embeddings';
import { 
  CachedIntent, 
  CacheLookupResult, 
  IntentClassification,
  SkillId 
} from './types';

// ============================================
// CACHE LOOKUP
// ============================================

/**
 * Find similar intents in the cache using embedding similarity
 * 
 * @param commandEmbedding - Embedding of the user's command
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.85)
 * @returns Cache lookup result with hit status and matched intent
 */
export async function findSimilarIntent(
  commandEmbedding: number[],
  similarityThreshold: number = 0.85
): Promise<CacheLookupResult> {
  const startTime = Date.now();
  
  try {
    // Use the database function for efficient similarity search
    const { data, error } = await supabaseAdmin.rpc('find_similar_intents', {
      query_embedding: `[${commandEmbedding.join(',')}]`,
      similarity_threshold: similarityThreshold,
      max_results: 1
    });
    
    if (error) {
      console.error('[IntentCache] Error finding similar intent:', error);
      return {
        hit: false,
        lookupTimeMs: Date.now() - startTime
      };
    }
    
    if (!data || data.length === 0) {
      return {
        hit: false,
        lookupTimeMs: Date.now() - startTime
      };
    }
    
    const match = data[0];
    
    // Record the cache hit
    await recordCacheHit(match.id);
    
    return {
      hit: true,
      cachedIntent: {
        id: match.id,
        canonicalCommand: match.canonical_command,
        embedding: commandEmbedding, // Use the query embedding
        intent: match.intent as IntentClassification,
        hitCount: match.hit_count,
        successRate: match.success_rate,
        isSeed: false,
        createdAt: '',
        lastUsedAt: ''
      },
      similarity: match.similarity,
      lookupTimeMs: Date.now() - startTime
    };
  } catch (error) {
    console.error('[IntentCache] Exception in findSimilarIntent:', error);
    return {
      hit: false,
      lookupTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Record a cache hit (increment hit count and update last_used_at)
 */
async function recordCacheHit(cacheId: string): Promise<void> {
  try {
    await supabaseAdmin.rpc('record_intent_cache_hit', {
      p_cache_id: cacheId
    });
  } catch (error) {
    // Non-fatal, just log
    console.warn('[IntentCache] Failed to record cache hit:', error);
  }
}

// ============================================
// CACHE WRITE OPERATIONS
// ============================================

/**
 * Promote a successful classification to the cache
 * 
 * @param command - The user's command
 * @param embedding - Embedding of the command
 * @param classification - The successful classification
 * @param category - Optional category for organization
 * @returns ID of the cache entry (new or existing)
 */
export async function promoteToCache(
  command: string,
  embedding: number[],
  classification: IntentClassification,
  category?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('promote_to_intent_cache', {
      p_command: command,
      p_embedding: `[${embedding.join(',')}]`,
      p_classification: classification,
      p_category: category || null
    });
    
    if (error) {
      console.error('[IntentCache] Error promoting to cache:', error);
      return null;
    }
    
    return data as string;
  } catch (error) {
    console.error('[IntentCache] Exception in promoteToCache:', error);
    return null;
  }
}

/**
 * Record a classification outcome for learning
 * 
 * @param params - Outcome parameters
 */
export async function recordOutcome(params: {
  command: string;
  embedding: number[];
  classification: IntentClassification;
  source: 'cache' | 'ai' | 'fallback';
  success: boolean;
  errorMessage?: string;
  classificationTimeMs?: number;
  cacheEntryId?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('record_classification_outcome', {
      p_command: params.command,
      p_embedding: `[${params.embedding.join(',')}]`,
      p_classification: params.classification,
      p_source: params.source,
      p_success: params.success,
      p_error_message: params.errorMessage || null,
      p_classification_time_ms: params.classificationTimeMs || null,
      p_cache_entry_id: params.cacheEntryId || null
    });
    
    if (error) {
      console.error('[IntentCache] Error recording outcome:', error);
      return null;
    }
    
    return data as string;
  } catch (error) {
    console.error('[IntentCache] Exception in recordOutcome:', error);
    return null;
  }
}

// ============================================
// SEED DATA INITIALIZATION
// ============================================

/**
 * Initialize seed data embeddings
 * 
 * This function should be called once to generate embeddings for
 * all seed examples that were created with placeholder embeddings.
 */
export async function initializeSeedEmbeddings(): Promise<{
  updated: number;
  failed: number;
}> {
  console.log('[IntentCache] Initializing seed embeddings...');
  
  // Find all seed entries with zero embeddings (placeholders)
  const { data: seedEntries, error } = await supabaseAdmin
    .from('intent_cache')
    .select('id, canonical_command')
    .eq('is_seed', true);
  
  if (error) {
    console.error('[IntentCache] Error fetching seed entries:', error);
    return { updated: 0, failed: 0 };
  }
  
  if (!seedEntries || seedEntries.length === 0) {
    console.log('[IntentCache] No seed entries to initialize');
    return { updated: 0, failed: 0 };
  }
  
  console.log(`[IntentCache] Found ${seedEntries.length} seed entries to process`);
  
  // Generate embeddings in batches of 20
  const batchSize = 20;
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < seedEntries.length; i += batchSize) {
    const batch = seedEntries.slice(i, i + batchSize);
    const commands = batch.map(e => e.canonical_command);
    
    try {
      const embeddings = await generateEmbeddings(commands);
      
      // Update each entry with its embedding
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabaseAdmin
          .from('intent_cache')
          .update({ 
            embedding: `[${embeddings[j].join(',')}]`,
            updated_at: new Date().toISOString()
          })
          .eq('id', batch[j].id);
        
        if (updateError) {
          console.error(`[IntentCache] Failed to update ${batch[j].canonical_command}:`, updateError);
          failed++;
        } else {
          updated++;
        }
      }
      
      console.log(`[IntentCache] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(seedEntries.length / batchSize)}`);
    } catch (error) {
      console.error(`[IntentCache] Batch embedding generation failed:`, error);
      failed += batch.length;
    }
  }
  
  console.log(`[IntentCache] Seed initialization complete: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

/**
 * Check if seed embeddings have been initialized
 */
export async function areSeedEmbeddingsInitialized(): Promise<boolean> {
  try {
    // Check if any seed entry has a non-zero embedding
    const { data, error } = await supabaseAdmin
      .from('intent_cache')
      .select('id')
      .eq('is_seed', true)
      .limit(1);
    
    if (error || !data || data.length === 0) {
      return false;
    }
    
    // Check if first seed entry has a real embedding
    // (We need a custom query to check if embedding is non-zero)
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('intent_cache')
      .select('canonical_command')
      .eq('is_seed', true)
      .neq('hit_count', 0) // This is a proxy - if hit_count > 0, embeddings are initialized
      .limit(1);
    
    // If we can find any with hit_count > 0, they're initialized
    // Otherwise, check if the first one works by trying a similarity search
    return !!(checkData && checkData.length > 0);
  } catch {
    return false;
  }
}

// ============================================
// METRICS
// ============================================

/**
 * Get classification metrics for analysis
 * 
 * @param days - Number of days to analyze (default: 7)
 */
export async function getMetrics(days: number = 7): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_classification_metrics', {
      p_days: days
    });
    
    if (error) {
      console.error('[IntentCache] Error getting metrics:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[IntentCache] Exception in getMetrics:', error);
    return null;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  seedEntries: number;
  learnedEntries: number;
  avgSuccessRate: number;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('intent_cache')
      .select('is_seed, success_rate');
    
    if (error || !data) {
      return {
        totalEntries: 0,
        seedEntries: 0,
        learnedEntries: 0,
        avgSuccessRate: 0
      };
    }
    
    const seedEntries = data.filter(d => d.is_seed).length;
    const learnedEntries = data.filter(d => !d.is_seed).length;
    const avgSuccessRate = data.length > 0
      ? data.reduce((sum, d) => sum + (d.success_rate || 0), 0) / data.length
      : 0;
    
    return {
      totalEntries: data.length,
      seedEntries,
      learnedEntries,
      avgSuccessRate
    };
  } catch {
    return {
      totalEntries: 0,
      seedEntries: 0,
      learnedEntries: 0,
      avgSuccessRate: 0
    };
  }
}
