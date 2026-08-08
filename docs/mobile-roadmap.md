# BRAIL Mobile App — Roadmap

Status: Phase 0 (kickoff). Branch: `feature/mobile-app`.

## Why

BRAIL currently ships as a Next.js web app only. Students want a real mobile
app, in particular with push notifications for deadlines/study nudges that
work the way WhatsApp's do — delivered even when the app is closed. A plain
PWA can't reliably do this on iOS, so this roadmap targets a native app.

## Stack decision

- **Expo (React Native) + TypeScript**, built with EAS Build for iOS/Android.
- **Backend reuse**: no backend rewrite. The mobile app is a new client
  against the existing Next.js API (`app/api/*`) and Supabase Auth/Postgres.
- **Push**: Expo Notifications (Expo Push Service → APNs/FCM), device tokens
  stored server-side and fanned out from the existing Vercel Cron reminder
  job.
- **Repo layout**: new top-level `mobile/` directory, isolated from the
  Next.js `app/` build.

## Phases

### Phase 1 — Scaffold & Auth
- [x] `mobile/` Expo TS app created (`create-expo-app`)
- [x] Supabase Auth client wired up (`@supabase/supabase-js`)
- [ ] Login/signup screens reusing existing KNUST auth flow (login screen
      exists; needs live end-to-end testing against a real account)
- [x] **Backend: Bearer-token auth for `app/api/*`.**
      `src/lib/supabase/api-auth.ts` (`getSupabaseUserFromRequest`) accepts
      `Authorization: Bearer <access_token>` and falls back to the existing
      cookie session, so the same route works from both the mobile app and
      the web app. Only wired into the mobile-facing route so far
      (`/api/mobile/device-token`) — **each existing `app/api/*` route the
      mobile app needs to call still has to be switched from
      `getSupabaseUser()` to `getSupabaseUserFromRequest(request)`** one by
      one as mobile screens are built (see Phase 2).

### Phase 2 — Core screens
**Important scope correction**: most of the web app's data (courses, tasks,
timetable, goals, dashboard, performance, peers) is fetched via Next.js
Server Components and mutated via Server Actions, not JSON API routes —
`app/api/*` currently only has ~10 routes (AI chat, notifications, materials
upload/download, diagnostics, study-plan/timetable generation, cron). There
is **no existing REST/JSON surface for most mobile screens below**; each one
needs a new thin `app/api/mobile/*` (or similar) route added, calling into
the same `src/features/<area>/queries.ts` / `actions.ts` functions the web
app's Server Components/Actions already use (business logic is reusable,
just not yet exposed as JSON). Use `getSupabaseUserFromRequest` (Phase 1)
for auth in each new route.

- [ ] Dashboard/Today — new API route(s) + screen
- [ ] Courses — new API route(s) + screen
- [ ] Tasks/Deadlines — new API route(s) + screen
- [ ] Timetable — new API route(s) + screen
- [ ] Goals — new API route(s) + screen
- [ ] AI Chat — `/api/ai/chat` already exists as a route; needs
      `getSupabaseUserFromRequest` swap + screen
- [ ] Notifications inbox — `/api/notifications/poll` and
      `/api/notifications/[notificationId]` already exist; need
      `getSupabaseUserFromRequest` swap + screen

### Phase 3 — Push notifications
- [x] `expo-notifications` integrated, permission flow
- [x] `expo-dev-client` + `eas.json` (`development`/`preview`/`android apk`
      profiles) added. **Required**: Expo Go does not support remote push
      notifications on Android from SDK 53 onward (local/in-app
      notifications still work there, but not background push), so testing
      the actual push feature needs a dev-client build, not Expo Go. Build
      one with `eas login` (one-time, your own Expo account) then
      `eas build --profile development --platform android` from `mobile/`;
      install the resulting APK on a device, then run
      `npm run start:dev-client`.
- [x] `DeviceToken` Prisma model + `POST /api/mobile/device-token`
      registration route (migration
      `20260808200905_mobile_push_device_tokens`)
- [x] Cron reminder job (`src/features/notifications/cron.ts`) extended:
      `src/features/notifications/push.ts` sends Expo push to every
      registered device for a user's unpushed reminders, marks them
      `pushedAt`, and prunes tokens Expo reports as
      `DeviceNotRegistered`. Not yet tested against a real device — do that
      once a dev-client build is installed (see below) and a device token is
      registered via login.
- [ ] Deep-linking from push tap into the relevant screen

### Phase 4 — Reliability & offline
- [ ] React Query + AsyncStorage caching for timetable/tasks
- [ ] Graceful degradation on flaky campus wifi

### Phase 5 — Build & pilot
- [ ] EAS Build config (dev/staging/prod profiles matching existing Supabase
      environments per `docs/deployment.md`)
- [ ] Internal distribution (TestFlight / Android internal testing)
- [ ] Join the existing 2-week student pilot (`docs/migration-roadmap.md`)
- [ ] App Store / Play Store submission

## Open questions / follow-ups

- Notification categories/preferences (which reminders opt-in by default)
- Whether AI chat needs a lighter mobile-specific UX vs. reusing web
  behavior as-is
- App icon/branding assets

## References

- Product context: [`docs/product-context.md`](./product-context.md)
- Web release baseline: [`docs/release-baseline.md`](./release-baseline.md)
- Web migration roadmap: [`docs/migration-roadmap.md`](./migration-roadmap.md)
- Deployment/cron setup: [`docs/deployment.md`](./deployment.md)
