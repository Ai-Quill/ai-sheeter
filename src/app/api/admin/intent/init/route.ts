/**
 * Initialize Intent Cache Seed Embeddings
 * 
 * This endpoint should be called once after deploying the intent_cache
 * migration to generate embeddings for all seed examples.
 * 
 * POST /api/admin/intent/init
 * 
 * @version 1.0.0
 * @created 2026-02-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeSeedEmbeddings, getCacheStats, getMetrics } from '@/lib/intent';

export async function POST(request: NextRequest) {
  try {
    console.log('[Intent Init] Starting seed embeddings initialization...');
    
    // Get current stats before
    const statsBefore = await getCacheStats();
    console.log('[Intent Init] Stats before:', statsBefore);
    
    // Initialize embeddings
    const result = await initializeSeedEmbeddings();
    
    // Get updated stats
    const statsAfter = await getCacheStats();
    console.log('[Intent Init] Stats after:', statsAfter);
    
    return NextResponse.json({
      success: true,
      message: 'Seed embeddings initialized successfully',
      result,
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
