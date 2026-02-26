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

  console.log('Webhook received:', event.type)

  // RLS をバイパスするため service_role_key を使う
  const supabase = createServiceClient({ requireServiceRole: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Session data:', {
          customer: session.customer,
          subscription: session.subscription,
          client_reference_id: session.client_reference_id,
          customer_email: session.customer_email,
          metadata: session.metadata,
        })

        const email = session.customer_details?.email ?? session.customer_email
        if (!email) {
          console.error('[Stripe webhook] No email found in checkout session')
          break
        }

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : null

        let planType = 'pro'
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price?.id
          console.log('Price ID from subscription:', priceId)
          if (priceId) {
            planType = planFromPriceId(priceId)
          }
        }

        console.log('Updating profile:', {
          email,
          planType,
          customer: session.customer,
          subscriptionId,
        })

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            plan: planType,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
            stripe_subscription_id: subscriptionId,
          })
          .eq('email', email)

        if (updateError) {
          console.error('[Stripe webhook] Profile update failed:', updateError)
        } else {
          console.log('[Stripe webhook] Profile updated successfully to:', planType)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        const isActive = ['active', 'trialing'].includes(subscription.status)
        const plan = isActive && priceId ? planFromPriceId(priceId) : 'free'

        console.log('customer.subscription.updated:', { customerId, priceId, plan, status: subscription.status })

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            plan,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId)

        if (updateError) {
          console.error('[Stripe webhook] subscription.updated profile update failed:', updateError)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log('customer.subscription.deleted:', { customerId })

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)

        if (updateError) {
          console.error('[Stripe webhook] subscription.deleted profile update failed:', updateError)
        }
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
