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
| Transaction pooler connection string (port 6543), with `?pgbouncer=true` appended | Settings → Database | `DATABASE_URL` |
| Session pooler connection string (port 5432) | Settings → Database | `DIRECT_URL` |

`prisma/schema.prisma` splits these deliberately:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // transaction pooler — used by the running app
  directUrl = env("DIRECT_URL")     // session pooler — used by Prisma Migrate
}
```

The transaction pooler can't take the advisory locks `prisma migrate deploy` needs, so both are required.

**Use the Session pooler for `DIRECT_URL`, not the raw "Direct connection" host** (`db.<ref>.supabase.co:5432`). That host is IPv6-only unless the project has Supabase's IPv4 add-on, and Vercel's build containers have no IPv6 egress — `migrate deploy` fails there with `P1001: Can't reach database server`. The Session pooler is the same hostname as `DATABASE_URL` (`aws-*.pooler.supabase.com`), just on port `5432` instead of `6543`, and is IPv4-reachable.

**`DATABASE_URL` must include `?pgbouncer=true`.** Supabase's Transaction pooler doesn't support the named prepared statements Prisma uses by default. Without this flag, concurrent serverless invocations sharing pooled connections intermittently collide on stale prepared statements — symptom: random `PrismaClientUnknownRequestError: ... ConnectorError` on arbitrary queries (not always the same one), mixed in with otherwise-successful requests seconds apart. `DIRECT_URL` (Session pooler) does not need this flag.

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
| `DATABASE_URL` | Yes | Supabase Settings → Database (Transaction pooler, 6543 — append `?pgbouncer=true`, see above) |
| `DIRECT_URL` | Yes | Supabase Settings → Database (Session pooler, 5432 — not the raw direct-connection host, see above) |
| `GROQ_API_KEY` | For AI features | groq.com console |
| `AI_MODEL` | For AI features | e.g. `openai/gpt-oss-20b` |
| `ADMIN_EMAILS` | For admin access | comma-separated emails |
| `CRON_SECRET` | For background reminders | generate locally (below), Vercel Cron sends it automatically as a Bearer token once the env var exists |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For browser push notifications | generate locally with `npx web-push generate-vapid-keys`; `VAPID_SUBJECT` is a `mailto:` contact. Use a **different** keypair per environment. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For browser push notifications | same value as `VAPID_PUBLIC_KEY`, exposed to the client for the subscribe call |
| `AI_DAILY_MESSAGE_LIMIT`, `AI_DAILY_TOKEN_LIMIT`, `AI_GLOBAL_DAILY_TOKEN_LIMIT` | Optional | sensible defaults apply if omitted |

`CRON_SECRET` must be set separately for **Production** and **Preview** — Vercel Cron only invokes `/api/cron/notifications` on Production deployments by default, so a `CRON_SECRET` that only exists under Preview will leave background reminders silently disabled (the route 503s) on the live site. Check Project Settings → Environment Variables → the Production column specifically.

Generate `CRON_SECRET` without ever putting it in chat or a committed file:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Deploy. `vercel.json` overrides the build command to `npx prisma migrate deploy && next build`, so every deploy applies pending migrations first — check the build log for the applied-migrations count. This override only affects Vercel; local `npm run build` and `.github/workflows/ci.yml` are untouched.

## 3. Verify

- Visit the deployment: sign up a real test account, complete onboarding, add a course, generate a study plan.
- Confirm the build log showed a clean `prisma migrate deploy` run against a fresh database.
- Vercel's Hobby plan only allows cron jobs to run once per day. `vercel.json` schedules `/api/cron/notifications` at `0 6 * * *` (06:00 UTC daily) to fit that limit. Note that a signed-in user with the app open anywhere already gets fresh in-app reminders independent of this cron — `NotificationBell`/`NotificationPoller` regenerate "nearing" reminders themselves on a throttled ~1-minute cadence (see `syncThrottleMs` in `src/features/notifications/service.ts`). The daily cron (and push delivery, below) only matters for reaching a user who **isn't** actively browsing.
- For push notifications (mobile Expo and browser Web Push) to arrive close to their actual time, `/api/cron/notifications` needs to run far more often than once a day. Two ways to get that without the Hobby-plan limit:
  - **Free**: point an external scheduler — a free monitor on [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org), or a scheduled GitHub Actions workflow — at `GET https://<your-domain>/api/cron/notifications` with header `Authorization: Bearer <CRON_SECRET>`, every 5 minutes. Leave `vercel.json`'s daily cron in place as a harmless fallback.
  - **Paid**: upgrade the Vercel project to Pro and tighten `vercel.json`'s `crons` schedule (e.g. `*/5 * * * *`).
  Either way, this only affects background notification generation and push delivery timing, not the rest of the app.
- Optionally re-run `npm run security:database` against the new project to confirm RLS and Storage lockdown survived the fresh migration replay. The script reads `.env.local` directly (not configurable), so this means temporarily pointing a local `.env.local` at the new project's credentials.

## 4. Deploying updates from a working directory

**Pushing a branch to GitHub does not deploy it to Production by itself.** Vercel only auto-deploys the branch configured as the **Production Branch** (Project Settings → Git, currently `readyapp`) when it receives a push; any other branch — including feature branches worked on in a chat session — only gets a Preview deployment from GitHub's side, if that. To ship a feature branch straight to the live Production URL without first merging it, deploy it directly with the Vercel CLI:

```bash
npx vercel --prod --yes --archive=tgz
```

Run this from the repo root, on whichever branch/working tree has the changes you want live — it uploads and deploys the *local working directory* as-is (uncommitted changes included), independent of what's pushed to GitHub.

Two things about this command that aren't obvious from `vercel --help`:

- **`--archive=tgz` is required.** Without it, `vercel deploy`/`vercel --prod` fails outright with `missing_archive` / `` `files` should NOT have more than 15000 items `` — this repo's working tree (with `node_modules` etc.) comfortably exceeds Vercel's raw per-file upload cap. The tgz archive path has no such limit.
- **The project is already linked** in this repo via `.vercel/project.json` (gitignored, machine-specific — read `.vercel/project.json`'s `projectId`/`orgId` if you need to relink from a fresh checkout with `vercel link`). `npx vercel whoami` confirms which account is authenticated before deploying; if it errors, `npx vercel login` first.

Before running a production deploy, check `npx vercel ls` for anything already mid-deploy (age under a couple minutes with no `Ready`/`Error` status yet) — this project sometimes has other automated sessions deploying directly via this same CLI path, and two concurrent production deploys can race. The command can take a few minutes (upload + `prisma migrate deploy` + `next build`); it's safe to background it and poll `vercel ls` or re-check its own output rather than blocking on it.

A successful run ends with `▲ Aliased  https://brailknust.vercel.app` — that confirms the new deployment took over the production alias, not just that a deployment was created. A quick sanity check afterward: `curl -s -o /dev/null -w "%{http_code}\n" https://brailknust.vercel.app/api/cron/notifications` should return `401` (auth required) — a `503` means `CRON_SECRET` isn't actually set on Production despite the table above.
