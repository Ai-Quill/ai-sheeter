/**
 * @file /api/templates
 * @version 1.0.0
 * @updated 2026-01-22
 * 
 * Workflow Templates API
 * 
 * Enables users to:
 * 1. Browse available workflow templates
 * 2. Search templates by category
 * 3. Use templates as starting points
 * 
 * Future: Allow users to publish their own workflows as templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowTemplates } from '@/lib/workflow-memory';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * 
 * Query params:
 * - category: Optional category filter (sales, customer_feedback, hr, etc.)
 * - limit: Max number of results (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('[Templates] Fetching templates:', { category, limit });

    const templates = await getWorkflowTemplates(category, limit);

    return NextResponse.json({
      success: true,
      count: templates.length,
      templates,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Templates] Error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to fetch templates: ' + errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * 
 * Future: Allow users to publish their workflows as public templates
 * Requires authentication and workflow validation
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Publishing templates not yet implemented' },
    { status: 501 }
  );
}
