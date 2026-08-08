# Deploying BRAIL

This is the runbook for standing up a live deployment (Vercel + a dedicated Supabase project). It documents the pooled/direct database connections and the Storage/Auth setup that Prisma migrations alone don't cover.

A deployment created from this runbook is a **staging/preview build**, not a production launch. Real production launch is gated on the rest of [migration-roadmap.md](./migration-roadmap.md): published privacy/terms/support policies, a student pilot, a rehearsed backup/restore, and structured monitoring. None of those block getting a working URL live.

Use a separate Supabase project per environment (development, staging, production). Never point a deployment at another environment's project, and never commit real credentials — see [release-baseline.md](./release-baseline.md) for the environment inventory this project tracks.

## 1. Create a Supabase project

Create a new project at [supabase.com](https://supabase.com) dedicated to this deployment (e.g. `brail-staging`). Matching the existing development project's region keeps latency comparable.

Collect these values from the project dashboard:

| Value | Where | Env var |
| --- | --- | --- |
| Project URL | Settings → API | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | Settings → API | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | Settings → API | `SUPABASE_SERVICE_ROLE_KEY` |
| Transaction pooler connection string (port 6543) | Settings → Database | `DATABASE_URL` |
| Direct connection string (port 5432) | Settings → Database | `DIRECT_URL` |

`prisma/schema.prisma` splits these deliberately:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — used by the running app
  directUrl = env("DIRECT_URL")     // direct — used by Prisma Migrate
}
```

The pooled connection can't take the advisory locks `prisma migrate deploy` needs, so both are required.

### Storage bucket

Create a bucket named exactly `course-materials`, set **Private**. This step can't be scripted against a live project — `scripts/verify-database-security.mjs --bootstrap-local-storage` explicitly refuses to run against anything but a localhost Supabase instance.

### Auth redirect URLs

Once you know the deployment's domain (Vercel reserves it at project creation, before the first deploy — see step 2), set in **Authentication → URL Configuration**:

- Site URL: `https://<your-domain>`
- Redirect URLs: add `https://<your-domain>/auth/callback`

Supabase rejects any OAuth/magic-link redirect target that isn't on this allow-list, so this must be done before the first real sign-in attempt.

## 2. Create the Vercel project

1. [vercel.com](https://vercel.com) → Add New Project → import the `brailknust/brailknust` GitHub repo.
2. Set the **Production Branch** to the branch you want auto-deploying (`readyapp` during active development).
3. Project Settings → Environment Variables — add for both Production and Preview:

| Env var | Required | Source |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Settings → API |
| `DATABASE_URL` | Yes | Supabase Settings → Database (pooled, 6543) |
| `DIRECT_URL` | Yes | Supabase Settings → Database (direct, 5432) |
| `GROQ_API_KEY` | For AI features | groq.com console |
| `AI_MODEL` | For AI features | e.g. `openai/gpt-oss-20b` |
| `ADMIN_EMAILS` | For admin access | comma-separated emails |
| `CRON_SECRET` | For background reminders | generate locally (below), Vercel Cron sends it automatically as a Bearer token once the env var exists |
| `AI_DAILY_MESSAGE_LIMIT`, `AI_DAILY_TOKEN_LIMIT`, `AI_GLOBAL_DAILY_TOKEN_LIMIT` | Optional | sensible defaults apply if omitted |

Generate `CRON_SECRET` without ever putting it in chat or a committed file:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Deploy. `vercel.json` overrides the build command to `npx prisma migrate deploy && next build`, so every deploy applies pending migrations first — check the build log for the applied-migrations count. This override only affects Vercel; local `npm run build` and `.github/workflows/ci.yml` are untouched.

## 3. Verify

- Visit the deployment: sign up a real test account, complete onboarding, add a course, generate a study plan.
- Confirm the build log showed a clean `prisma migrate deploy` run against a fresh database.
- Vercel's Hobby plan only allows cron jobs to run once per day. `vercel.json` schedules `/api/cron/notifications` at `0 6 * * *` (06:00 UTC daily) to fit that limit — background reminders are generated once a day rather than near-real-time. Upgrade the Vercel project to Pro and tighten the schedule (e.g. back to every 5 minutes) once more frequent reminder delivery matters; this only affects background notification generation, not the rest of the app.
- Optionally re-run `npm run security:database` against the new project to confirm RLS and Storage lockdown survived the fresh migration replay. The script reads `.env.local` directly (not configurable), so this means temporarily pointing a local `.env.local` at the new project's credentials.
