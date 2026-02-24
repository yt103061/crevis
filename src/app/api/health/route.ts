import { NextResponse } from 'next/server'

function has(value: string | undefined) {
  return !!value && value.trim().length > 0
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Health endpoint is available',
    env: {
      vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
      vercelRegion: process.env.VERCEL_REGION ?? 'unknown',
    },
    endpoints: {
      config: '/api/health/config',
    },
    requiredForLogin: {
      NEXT_PUBLIC_SUPABASE_URL: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    hintIf404:
      'If this endpoint is 404 on Vercel, the deployment likely does not include the latest commit. Trigger a redeploy from the newest commit.',
  })
}

export const preferredRegion = 'nrt1'
