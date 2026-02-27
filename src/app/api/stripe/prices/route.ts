import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    reader: process.env.STRIPE_READER_PRICE_ID ?? null,
    pro: process.env.STRIPE_PRO_PRICE_ID ?? null,
  })
}
