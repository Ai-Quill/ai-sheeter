/**
 * @file /api/agent/conversation
 * @description Agent conversation persistence API
 * 
 * Endpoints:
 * - GET: Load conversation for a spreadsheet
 * - POST: Save/update conversation state
 * - DELETE: Clear conversation (start fresh)
 * 
 * Pain point solved: "Users often lose context with Gemini"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return supabase;
}

interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  metadata?: {
    plan?: object;
    taskType?: string;
    jobIds?: string[];
  };
}

interface ConversationState {
  messages: ConversationMessage[];
  context: object;
  currentTask?: object;
  lastInteraction: string;
}

/**
 * GET /api/agent/conversation
 * Load conversation for a specific spreadsheet
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const spreadsheetId = searchParams.get('spreadsheetId');

    if (!userId || !spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing userId or spreadsheetId' },
        { status: 400 }
      );
    }

    // Fetch conversation
    const { data, error } = await getSupabase()
      .from('agent_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('spreadsheet_id', spreadsheetId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error loading conversation:', error);
      return NextResponse.json(
        { error: 'Failed to load conversation' },
        { status: 500 }
      );
    }

    if (!data) {
      // No existing conversation - return empty state
      return NextResponse.json({
        hasConversation: false,
        conversation: null
      });
    }

    // Check if conversation is stale (> 7 days old)
    const lastInteraction = new Date(data.last_interaction_at);
    const daysSinceInteraction = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
    const isStale = daysSinceInteraction > 7;

    return NextResponse.json({
      hasConversation: true,
      isStale,
      daysSinceInteraction: Math.floor(daysSinceInteraction),
      conversation: {
        id: data.id,
        sheetName: data.sheet_name,
        messages: data.messages || [],
        context: data.context || {},
        currentTask: data.current_task,
        lastInteraction: data.last_interaction_at,
        createdAt: data.created_at
      }
    });

  } catch (error) {
    console.error('Conversation GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/conversation
 * Save or update conversation state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, spreadsheetId, sheetName, messages, context, currentTask } = body;

    if (!userId || !spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing userId or spreadsheetId' },
        { status: 400 }
      );
    }

    // Limit messages to last 50 to prevent bloat
    const limitedMessages = (messages || []).slice(-50);

    // Upsert conversation (create or update)
    const { data, error } = await getSupabase()
      .from('agent_conversations')
      .upsert({
        user_id: userId,
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName || null,
        messages: limitedMessages,
        context: context || {},
        current_task: currentTask || null,
        updated_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,spreadsheet_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving conversation:', error);
      return NextResponse.json(
        { error: 'Failed to save conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId: data?.id,
      messageCount: limitedMessages.length
    });

  } catch (error) {
    console.error('Conversation POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent/conversation
 * Clear conversation (start fresh)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const spreadsheetId = searchParams.get('spreadsheetId');

    if (!userId || !spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing userId or spreadsheetId' },
        { status: 400 }
      );
    }

    // Delete conversation
    const { error } = await getSupabase()
      .from('agent_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('spreadsheet_id', spreadsheetId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation cleared'
    });

  } catch (error) {
    console.error('Conversation DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
