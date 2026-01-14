/**
 * Analytics API - Event Logging
 * 
 * Endpoints:
 * - POST /api/analytics/log - Log analytics events (batch)
 * 
 * Purpose:
 * - Track user behavior for product improvement
 * - Identify common errors and pain points
 * - Prepare for future chat history feature
 * 
 * Privacy:
 * - No cell content is stored
 * - Only metadata and sanitized command text
 * - User can request data deletion (GDPR)
 * 
 * @created 2026-01-14
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Event types we accept
const VALID_EVENT_TYPES = ['command', 'plan', 'execution', 'error', 'action', 'other'];

// Maximum events per batch (prevent abuse)
const MAX_EVENTS_PER_BATCH = 100;

// Maximum string length for payload fields
const MAX_STRING_LENGTH = 500;

interface AnalyticsEvent {
  userId: string;
  spreadsheetId?: string;
  sessionId: string;
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}

/**
 * Sanitize a string field to prevent storing excessive data
 */
function sanitizeString(value: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  return value.substring(0, maxLength);
}

/**
 * Sanitize payload to ensure we only store safe data
 */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  
  const sanitized: Record<string, unknown> = {};
  
  // Whitelist of allowed fields
  const allowedFields = [
    'command', 'commandLanguage', 'planType', 'inputRange', 'outputColumns',
    'rowCount', 'model', 'duration', 'status', 'errorType', 'errorMessage',
    'jobCount', 'taskType', 'action', 'source', 'confidence', 'isMultiColumn',
    'columnCount', 'hasCustomPrompts', 'hasValidation', 'formatHint'
  ];
  
  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      const value = payload[field];
      
      if (typeof value === 'string') {
        sanitized[field] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        // Only allow arrays of primitives, limit to 20 items
        sanitized[field] = value
          .slice(0, 20)
          .map(v => typeof v === 'string' ? sanitizeString(v, 50) : v)
          .filter(v => v !== null && v !== undefined);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[field] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitize context to ensure we only store safe metadata
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  if (!context || typeof context !== 'object') return {};
  
  return {
    sheetName: sanitizeString(context.sheetName, 100),
    selectedRange: sanitizeString(context.selectedRange, 50),
    model: sanitizeString(context.model, 50),
    columnHeaders: Array.isArray(context.columnHeaders) 
      ? context.columnHeaders.slice(0, 10).map(h => sanitizeString(h, 50))
      : undefined
  };
}

/**
 * POST /api/analytics/log - Log analytics events
 * 
 * Request body:
 * {
 *   events: [{
 *     userId: string,
 *     spreadsheetId?: string,
 *     sessionId: string,
 *     timestamp: string (ISO8601),
 *     eventType: 'command' | 'plan' | 'execution' | 'error' | 'action',
 *     payload: { ... },
 *     context: { ... }
 *   }]
 * }
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { events } = body as { events: AnalyticsEvent[] };
    
    // Validate input
    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: 'events must be an array' },
        { status: 400 }
      );
    }
    
    if (events.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    
    if (events.length > MAX_EVENTS_PER_BATCH) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_EVENTS_PER_BATCH} events per batch` },
        { status: 400 }
      );
    }
    
    // Transform and sanitize events for database insert
    const rows = events
      .filter(event => event.userId && event.sessionId && event.eventType)
      .map(event => ({
        user_id: sanitizeString(event.userId, 100),
        spreadsheet_id: sanitizeString(event.spreadsheetId, 100),
        session_id: sanitizeString(event.sessionId, 100),
        event_timestamp: event.timestamp || new Date().toISOString(),
        event_type: VALID_EVENT_TYPES.includes(event.eventType) 
          ? event.eventType 
          : 'other',
        payload: sanitizePayload(event.payload || {}),
        context: sanitizeContext(event.context || {})
      }));
    
    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    
    // Batch insert to Supabase
    const { error } = await supabaseAdmin
      .from('analytics_events')
      .insert(rows);
    
    if (error) {
      console.error('Analytics insert error:', error);
      // Don't expose internal errors to client
      // But still return success - analytics should never block the user
      return NextResponse.json({ 
        success: true, 
        count: 0,
        warning: 'Some events may not have been logged'
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      count: rows.length 
    });
    
  } catch (error) {
    console.error('Analytics API error:', error);
    // Always return success for analytics - never block the user
    return NextResponse.json({ 
      success: true, 
      count: 0,
      warning: 'Analytics temporarily unavailable'
    });
  }
}

/**
 * GET /api/analytics/log - Health check
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({ 
    status: 'ok',
    service: 'analytics',
    timestamp: new Date().toISOString()
  });
}
