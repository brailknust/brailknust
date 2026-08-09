# BRAIL Mobile App — Roadmap

Status: Phase 1 auth verified, Phase 3 core push loop verified end-to-end on
a real device (Aug 9, 2026). Branch: `feature/mobile-app`.

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
- [x] Login/signup screens reusing existing KNUST auth flow — verified live
      on a physical Android device against a real dev-environment account.
      Signup screen still TODO (login only so far).
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
      `pushedAt`, and prunes tokens Expo reports as `DeviceNotRegistered`.
- [x] **Verified end-to-end on a physical Android device**: FCM credentials
      configured (Firebase project `brailknust-898cc`), dev-client build
      installed, real login → device token registered in `device_tokens` →
      manual push via Expo's API delivered and displayed on-device with the
      app fully closed. The full "delivered even when closed" requirement is
      confirmed working. (Cron-triggered delivery specifically, as opposed
      to this manual test, is still unexercised — same code path, but worth
      a real run once there's a live reminder to trigger on.)
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

## Local dev environment notes

Getting a physical device connected during this build-out surfaced a few
recurring gotchas on the campus Wi-Fi network — worth knowing before
re-debugging them from scratch next time:

- **The dev machine's Wi-Fi IP changes frequently** (observed 3 different
  addresses in one session). `mobile/.env`'s `EXPO_PUBLIC_API_BASE_URL` and
  any `EXPO_PACKAGER_PROXY_URL` you export need to match the *current* IP —
  check with `ipconfig` (look at the `Wireless LAN adapter Wi-Fi` block,
  not `Ethernet 3`, which is a VirtualBox host-only adapter on this machine
  and gets wrongly auto-advertised by Metro if not overridden).
- **The campus network appears to block phone↔PC direct connections**
  (`host unreachable` even with the correct IP and firewall rules already
  permitting Node) **and** blocks/throttles `expo start --tunnel`'s ngrok
  handshake (`ngrok tunnel took too long to connect`, reproduced 3× with
  general internet connectivity confirmed working). Workaround: put both
  devices on a phone personal hotspot instead — different subnet, isolation
  goes away, LAN mode (`expo start --dev-client` + `EXPO_PACKAGER_PROXY_URL`
  pointed at the PC's hotspot IP) works normally.
- **Android push requires real FCM credentials** (Expo dropped shared
  default push credentials as of SDK 53) — see Phase 3. `google-services.json`
  lives at `mobile/google-services.json` (safe to commit); the FCM V1
  service account private key was uploaded directly to EAS via
  `eas credentials` and never touches the repo.
- A dev-client build (not Expo Go) is required for any push-notification
  testing — see Phase 3.

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
