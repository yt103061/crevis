import { NextResponse } from 'next/server'

function has(value: string | undefined) {
  return !!value && value.trim().length > 0
}

export async function GET() {
  return NextResponse.json({
    env: {
      vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
    },
    requiredForLogin: {
      NEXT_PUBLIC_SUPABASE_URL: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    requiredForServer: {
      SUPABASE_SERVICE_ROLE_KEY: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ADMIN_EMAIL: has(process.env.ADMIN_EMAIL),
      CRON_SECRET: has(process.env.CRON_SECRET),
    },
    note: 'Values are never returned. Only presence booleans are exposed for diagnostics.',
  })
}
