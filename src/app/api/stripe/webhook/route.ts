import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

function planFromPriceId(priceId: string): string {
  const readerPriceId = process.env.STRIPE_READER_PRICE_ID?.trim()
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
  console.log('planFromPriceId:', {
    priceId,
    readerPriceId,
    proPriceId,
    matchReader: priceId === readerPriceId,
    matchPro: priceId === proPriceId,
  })
  if (priceId === readerPriceId) return 'reader'
  if (priceId === proPriceId) return 'pro'
  return 'pro' // フォールバック
}

// stripe_customer_id → なければ Stripe から email 取得 → email で検索
async function findProfileByCustomer(
  supabase: ReturnType<typeof createServiceClient>,
  stripe: Stripe,
  customerId: string
): Promise<{ id: string } | null> {
  // パターン a: stripe_customer_id で検索
  const { data: byCustomerId, error: e1 } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  console.log('findProfileByCustomer (by customer_id):', { customerId, found: !!byCustomerId, error: e1?.message })

  if (byCustomerId) return byCustomerId

  // パターン b: Stripe の customer オブジェクトから email を取得して検索
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      console.error('findProfileByCustomer: customer is deleted', customerId)
      return null
    }
    const email = (customer as Stripe.Customer).email
    console.log('findProfileByCustomer (fallback email):', { customerId, email })
    if (!email) return null

    const { data: byEmail, error: e2 } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    console.log('findProfileByCustomer (by email):', { email, found: !!byEmail, error: e2?.message })
    return byEmail ?? null
  } catch (err) {
    console.error('findProfileByCustomer: stripe.customers.retrieve failed:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // 環境変数を毎回 process.env から取得（Vercel キャッシュ対策）
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!signature || !stripeWebhookSecret || !stripeSecretKey) {
    console.error('Missing Stripe env vars:', {
      hasSecretKey: !!stripeSecretKey,
      hasWebhookSecret: !!stripeWebhookSecret,
      hasSignature: !!signature,
    })
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })
  }

  // webhook は raw body 検証が必要なため、ここで直接インスタンス化する
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
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

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : null

        // プラン判定: metadata.plan を優先し、なければ subscription の price ID から判定
        let planType: string = session.metadata?.plan ?? 'pro'
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items.data[0]?.price?.id
          console.log('Price ID from subscription:', priceId)
          if (priceId) {
            planType = planFromPriceId(priceId)
          }
        }

        const customerId = typeof session.customer === 'string' ? session.customer : null

        // 更新対象の特定: supabase_user_id があれば直接 id で更新（最も確実）
        const userId = session.metadata?.supabase_user_id
        if (userId) {
          console.log('Updating profile by user_id:', { userId, planType, customerId, subscriptionId })
          const { data, error: updateError } = await supabase
            .from('profiles')
            .update({
              plan: planType,
              ...(customerId ? { stripe_customer_id: customerId } : {}),
              stripe_subscription_id: subscriptionId,
            })
            .eq('id', userId)
            .select('id, plan')

          if (updateError) {
            console.error('[Stripe webhook] checkout update by user_id failed:', updateError)
          } else {
            console.log('[Stripe webhook] checkout updated by user_id:', data)
          }
          break
        }

        // フォールバック: email で検索
        const email = session.customer_details?.email ?? session.customer_email
        if (!email) {
          console.error('[Stripe webhook] No user_id or email found in checkout session')
          break
        }

        console.log('Updating profile by email:', { email, planType, customerId, subscriptionId })
        const { data, error: updateError } = await supabase
          .from('profiles')
          .update({
            plan: planType,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            stripe_subscription_id: subscriptionId,
          })
          .eq('email', email)
          .select('id, plan')

        if (updateError) {
          console.error('[Stripe webhook] checkout update by email failed:', updateError)
        } else {
          console.log('[Stripe webhook] checkout updated by email:', data)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        const isActive = ['active', 'trialing'].includes(subscription.status)
        const plan = isActive && priceId ? planFromPriceId(priceId) : 'free'

        console.log('customer.subscription.updated:', {
          customerId,
          priceId,
          plan,
          status: subscription.status,
          isActive,
        })

        const profile = await findProfileByCustomer(supabase, stripe, customerId)
        if (!profile) {
          console.error('[Stripe webhook] subscription.updated: profile not found for customer', customerId)
          break
        }

        const { data, error: updateError } = await supabase
          .from('profiles')
          .update({ plan, stripe_customer_id: customerId, stripe_subscription_id: subscription.id })
          .eq('id', profile.id)
          .select('id, plan')

        if (updateError) {
          console.error('[Stripe webhook] subscription.updated update failed:', updateError)
        } else {
          console.log('[Stripe webhook] subscription.updated success:', data)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log('customer.subscription.deleted:', { customerId })

        const profile = await findProfileByCustomer(supabase, stripe, customerId)
        if (!profile) {
          console.error('[Stripe webhook] subscription.deleted: profile not found for customer', customerId)
          break
        }

        const { data, error: updateError } = await supabase
          .from('profiles')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('id', profile.id)
          .select('id, plan')

        if (updateError) {
          console.error('[Stripe webhook] subscription.deleted update failed:', updateError)
        } else {
          console.log('[Stripe webhook] subscription.deleted reset to free:', data)
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
