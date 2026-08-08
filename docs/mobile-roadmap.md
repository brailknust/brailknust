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
- [ ] Login/signup screens reusing existing KNUST auth flow
- [ ] **Backend: add Bearer-token auth to `app/api/*`.** Verified that the
      existing API is cookie-session only (`src/proxy.ts` +
      `src/lib/supabase/server.ts` read the Supabase session from cookies).
      A mobile app authenticates with a Supabase access token, not a
      browser cookie jar, so API routes the app calls need to also accept
      `Authorization: Bearer <access_token>` (verify via
      `supabase.auth.getUser(token)` server-side) before any mobile screen
      can hit real data. Until this lands, `mobile/src/lib/api.ts` sends the
      bearer token but the server will not recognize it.

### Phase 2 — Core screens
- [ ] Dashboard/Today
- [ ] Courses
- [ ] Tasks/Deadlines
- [ ] Timetable
- [ ] Goals
- [ ] AI Chat
- [ ] Notifications inbox

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
- [ ] `DeviceToken` Prisma model + registration API route
- [ ] Vercel Cron reminder job extended to send Expo push alongside existing
      channel(s)
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
