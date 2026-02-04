/**
 * Initialize Intent Cache and Skill Example Seed Embeddings
 * 
 * This endpoint should be called once after deploying migrations
 * to generate embeddings for all seed examples:
 * 1. Intent cache seeds (for classification)
 * 2. Skill usage seeds (for few-shot response examples)
 * 
 * POST /api/admin/intent/init
 * 
 * @version 1.1.0
 * @created 2026-02-02
 * @updated 2026-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  initializeSeedEmbeddings, 
  initializeSkillExampleEmbeddings,
  getCacheStats, 
  getMetrics 
} from '@/lib/intent';

export async function POST(request: NextRequest) {
  try {
    console.log('[Intent Init] Starting seed embeddings initialization...');
    
    // Get current stats before
    const statsBefore = await getCacheStats();
    console.log('[Intent Init] Stats before:', statsBefore);
    
    // Initialize intent cache embeddings
    console.log('[Intent Init] Initializing intent cache embeddings...');
    const intentResult = await initializeSeedEmbeddings();
    
    // Initialize skill example embeddings
    console.log('[Intent Init] Initializing skill example embeddings...');
    const skillResult = await initializeSkillExampleEmbeddings();
    
    // Get updated stats
    const statsAfter = await getCacheStats();
    console.log('[Intent Init] Stats after:', statsAfter);
    
    return NextResponse.json({
      success: true,
      message: 'Seed embeddings initialized successfully',
      result: {
        intentCache: intentResult,
        skillExamples: skillResult,
      },
      statsBefore,
      statsAfter,
    });
    
  } catch (error) {
    console.error('[Intent Init] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const [stats, metrics] = await Promise.all([
      getCacheStats(),
      getMetrics(7),
    ]);
    
    return NextResponse.json({
      success: true,
      stats,
      metrics,
    });
    
  } catch (error) {
    console.error('[Intent Stats] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
