import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion })
}

function planFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_READER_PRICE_ID) return 'reader'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  return 'pro' // フォールバック
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        const subscriptionId = session.subscription as string

        if (!userId) break

        // subscription を expand して price ID からプランを判定
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        })
        const priceId = subscription.items.data[0]?.price?.id
        const plan = priceId ? planFromPriceId(priceId) : (session.metadata?.plan ?? 'pro')

        await supabase
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        const isActive = ['active', 'trialing'].includes(subscription.status)
        const plan = isActive && priceId ? planFromPriceId(priceId) : 'free'

        await supabase
          .from('profiles')
          .update({
            plan,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await supabase
          .from('profiles')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.error('[Stripe] Payment failed for customer:', invoice.customer, 'invoice:', invoice.id)
        break
      }
    }
  } catch (err) {
    console.error('[Stripe webhook] Handler error:', err)
    // 200 を返して Stripe のリトライを防ぐ（冪等性確保）
  }

  return NextResponse.json({ received: true })
}
