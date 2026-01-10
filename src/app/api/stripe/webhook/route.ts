/**
 * Stripe Webhook Handler
 * 
 * Handles subscription lifecycle events:
 * - checkout.session.completed → Create subscription
 * - invoice.paid → Renew subscription, reset credits
 * - customer.subscription.updated → Plan changes
 * - customer.subscription.deleted → Cancellation
 */

import { NextResponse } from 'next/server';
import { stripe, getCreditsForTier, type PlanTier } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

export async function POST(req: Request): Promise<Response> {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const tier = session.metadata?.tier as PlanTier;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No user_id in checkout session metadata');
    return;
  }

  // Create subscription record
  await supabaseAdmin.from('subscriptions').insert({
    user_id: userId,
    stripe_subscription_id: subscriptionId,
    plan_tier: tier,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });

  // Update user
  await supabaseAdmin
    .from('users')
    .update({
      stripe_customer_id: customerId,
      plan_tier: tier,
      credits_balance: getCreditsForTier(tier),
      credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`Subscription created for user ${userId}: ${tier}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // subscription can be string, Subscription object, or null
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' 
    ? invoice.parent.subscription_details.subscription
    : invoice.parent?.subscription_details?.subscription?.id;
  
  if (!subscriptionId) return;

  // Get subscription from our database
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, plan_tier')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Reset credits for the new billing period
  const credits = getCreditsForTier(sub.plan_tier as PlanTier);
  
  await supabaseAdmin
    .from('users')
    .update({
      credits_balance: credits,
      credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', sub.user_id);

  // Update subscription period
  await supabaseAdmin
    .from('subscriptions')
    .update({
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`Credits reset for user ${sub.user_id}: ${credits}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const cancelAtEnd = subscription.cancel_at_period_end;

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: status === 'active' ? 'active' : 
              status === 'past_due' ? 'past_due' :
              status === 'canceled' ? 'canceled' :
              status === 'trialing' ? 'trialing' : 'paused',
      cancel_at_period_end: cancelAtEnd,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;

  // Get user from subscription
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (sub) {
    // Downgrade user to free tier
    await supabaseAdmin
      .from('users')
      .update({
        plan_tier: 'free',
        credits_balance: 100,  // Free tier credits
        updated_at: new Date().toISOString()
      })
      .eq('id', sub.user_id);
  }

  // Mark subscription as canceled
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`Subscription canceled: ${subscriptionId}`);
}
