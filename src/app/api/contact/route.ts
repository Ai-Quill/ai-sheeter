/**
 * @file /api/contact
 * @version 1.1.0
 * @updated 2026-01-21
 * 
 * ============================================
 * CONTACT FORM API
 * ============================================
 * 
 * Handles contact form submissions from the landing page.
 * Saves submissions to Supabase contact_submissions table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    const { name, email, message } = body;

    // Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Save to Supabase database
    const { data, error: dbError } = await supabaseAdmin
      .from('contact_submissions')
      .insert({
        name,
        email,
        message,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Contact Form] Database error:', dbError);
      throw new Error('Failed to save contact submission');
    }

    // Log successful submission
    console.log('[Contact Form] Saved submission:', {
      id: data?.id,
      name,
      email,
      timestamp: new Date().toISOString(),
    });

    // TODO: Optional extensions:
    // 1. Send email notification (using SendGrid, AWS SES, Resend)
    // 2. Send to Slack/Discord webhook for instant notifications
    // 3. Integrate with CRM (HubSpot, Salesforce, etc.)
    // 4. Send auto-reply email to user confirming submission
    
    // Example: Send email notification
    // await sendEmail({
    //   to: 'tuanvutruong@gmail.com',
    //   subject: `New contact form: ${name}`,
    //   body: `From: ${name} (${email})\n\n${message}`,
    // });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Thank you for your message. We\'ll get back to you soon!' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Contact Form] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
