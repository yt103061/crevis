This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Environment Variables

Copy `.env.example` to `.env.local` and set at least the following for authentication to work:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, login/signup will show a configuration error.


### Troubleshooting: `Supabase is not configured`

If login shows `Supabase is not configured`, check these in Vercel:

1. Are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for the **same environment** you are accessing (`Production` vs `Preview`)?
2. Did you **redeploy after adding/changing env vars**? (`NEXT_PUBLIC_*` values are embedded at build time)
3. Open `/api/health/config` on your deployed URL and verify booleans are `true` for `requiredForLogin`.


If `/api/health/config` returns 404, open `/api/health` first. If both are 404, redeploy from the latest commit (the deployment is likely outdated).


## Scheduled Jobs (NL fetch / LP discovery)

This repository exposes protected cron endpoints:
- `GET /api/cron/nl-fetch`
- `GET /api/cron/lp-discover`

These endpoints require `CRON_SECRET` as either:
- `Authorization: Bearer <CRON_SECRET>`
- `?token=<CRON_SECRET>`

### Important for Vercel deployment

Vercel Cron Jobs availability depends on plan/limits. If deployment fails due cron settings, keep `vercel.json` without a `crons` block and trigger these endpoints from an external scheduler (e.g. GitHub Actions, UptimeRobot, cron-job.org).

Example schedule recommendation:
- NL fetch: every 12 hours
- LP discover: daily


### Region setting

This repository pins Vercel Functions to Tokyo with `"regions": ["hnd1"]` in `vercel.json` (Vercel region code for Tokyo).

If your project still runs in another region, also check Vercel Project Settings (Functions/Regions) and redeploy.
You can verify runtime region from `/api/health` or `/api/health/config` via `env.vercelRegion`.


If deployment still fails with `Invalid region`, remove the `regions` field from `vercel.json` and redeploy (project/plan constraints may restrict region pinning).
