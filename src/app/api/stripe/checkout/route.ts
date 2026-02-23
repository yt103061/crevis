import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion })
}

const PRICE_MAP: Record<string, { name: string; amount: number; interval: 'month' | 'year' }> = {
  pro_monthly: { name: 'Pro（月額）', amount: 980, interval: 'month' },
  pro_yearly: { name: 'Pro（年額）', amount: 9800, interval: 'year' },
  team_monthly: { name: 'Team（月額）', amount: 2980, interval: 'month' },
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId } = await request.json()
  const priceConfig = PRICE_MAP[priceId]
  if (!priceConfig) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
  }

  const stripe = getStripe()
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { supabase_user_id: session.user.id },
    })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', session.user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: { name: priceConfig.name },
          unit_amount: priceConfig.amount,
          recurring: { interval: priceConfig.interval },
        },
        quantity: priceId === 'team_monthly' ? 1 : 1,
      },
    ],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      supabase_user_id: session.user.id,
      plan: priceId.startsWith('team') ? 'team' : 'pro',
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
