/**
 * Stripe Customer Portal
 * 
 * Creates a session for users to manage their subscription:
 * - Update payment method
 * - View invoices
 * - Cancel subscription
 * - Change plan
 */

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request): Promise<Response> {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const { userEmail } = await req.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail required' }, { status: 400 });
    }

    // Get user's Stripe customer ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('email', userEmail)
      .single();

    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aisheet.vercel.app';

    // Create portal session
    // Note: Settings are managed in Google Sheets sidebar, redirect to home
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: appUrl
    });

    return NextResponse.json({ portalUrl: session.url });

  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Portal creation failed' 
    }, { status: 500 });
  }
}
