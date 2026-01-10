/**
 * Stripe Checkout Session
 * 
 * Creates a Stripe Checkout session for subscription signup.
 * User is redirected to Stripe's hosted checkout page.
 */

import { NextResponse } from 'next/server';
import { stripe, PRICING_TIERS, type PlanTier } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request): Promise<Response> {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const { userEmail, userId, tier } = await req.json();

    if (!userEmail || !tier) {
      return NextResponse.json({ error: 'userEmail and tier required' }, { status: 400 });
    }

    if (!['starter', 'pro', 'power'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const tierConfig = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aisheet.vercel.app';

    // Get or create Stripe customer
    let customerId: string;
    
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id')
      .eq('email', userEmail)
      .single();

    if (user?.stripe_customer_id) {
      customerId = user.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: user?.id || userId || 'unknown'
        }
      });
      customerId = customer.id;

      // Save customer ID
      if (user?.id) {
        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AISheeter ${tierConfig.name}`,
              description: tierConfig.features.join(', ')
            },
            unit_amount: tierConfig.priceMonthly * 100,  // Stripe uses cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: {
        user_id: user?.id || userId,
        tier: tier
      }
    });

    return NextResponse.json({ 
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Checkout failed' 
    }, { status: 500 });
  }
}
