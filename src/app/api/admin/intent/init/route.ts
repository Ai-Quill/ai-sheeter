/**
 * DEPRECATED: Intent Cache Initialization
 * 
 * This endpoint is no longer needed - the learning system has been simplified.
 * Modern LLMs handle intent from skill instructions alone, without:
 * - Embedding generation
 * - Vector database lookups
 * - Seed example management
 * 
 * @deprecated 2026-02-04 - Learning system simplified
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'DEPRECATED: Learning system simplified. AI handles intent from skill instructions alone.',
    info: 'This endpoint is no longer needed.',
  }, { status: 410 }); // 410 Gone
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'DEPRECATED: Learning system simplified. AI handles intent from skill instructions alone.',
    info: 'This endpoint is no longer needed.',
  }, { status: 410 }); // 410 Gone
}
