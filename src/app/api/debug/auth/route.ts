import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'

export async function GET() {
  const supabase = createServerSupabaseClient()

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  const adminEmail = process.env.ADMIN_EMAIL

  return NextResponse.json({
    adminEmail,
    session: session ? {
      userEmail: session.user?.email,
      userId: session.user?.id,
      expiresAt: session.expires_at,
    } : null,
    sessionError: sessionError?.message ?? null,
    user: user ? {
      email: user.email,
      id: user.id,
      emailConfirmedAt: user.email_confirmed_at,
    } : null,
    userError: userError?.message ?? null,
    match: user?.email === adminEmail,
  })
}
