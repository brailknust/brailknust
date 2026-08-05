# BRAIL Completion Roadmap

This is the canonical plan for taking BRAIL from its current implementation to production. See [product-context.md](./product-context.md) for the product north star.

## Current baseline

Last verified: 2026-08-05.

- Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, Supabase, Prisma, and Postgres.
- `npm run lint`, TypeScript validation, `npm test`, Prisma validation, and `npm run build` pass; the latest verified build generated 34 pages/routes.
- Authentication, onboarding, academics, tasks, planner, performance, goals, AI chat, diagnostic practice, peers, notifications, and admin content tooling are implemented.
- Support and Feedback now have authenticated persisted workflows and administrator review.
- Phase 1 security tests and Phase 2 unit, integration, component, and browser tests are configured. GitHub CI is defined; application error boundaries are implemented.
- Deployment, production migrations, storage policies, backups, and monitoring are not yet verified.

## Definition of done

BRAIL is launch-ready when:

1. A new student can complete every critical workflow without developer intervention.
2. Cross-account access and mutation attempts are rejected.
3. Critical business rules and journeys have automated tests.
4. AI, OCR, uploads, and database failures have deliberate recovery paths.
5. Staging matches production architecture and passes the release suite.
6. Backups, restores, monitoring, rollback, and incident procedures are proven.
7. Advertised KNUST curriculum coverage is complete and verified.
8. A two-week student pilot finishes without a launch-blocking defect.

## Phase 0: Release baseline

Target: 1-2 days.

Status: complete on 2026-08-04. The approved scope, feature classifications, acceptance criteria, environment inventory, migration state, and interim ownership are recorded in [release-baseline.md](./release-baseline.md).

- [x] Record current feature and build status.
- [x] Document required environment variables without secrets.
- [x] Make `.env.example` trackable.
- [x] Add setup and verification guidance to the README.
- [x] Confirm launch scope, curriculum limits, supported levels, and semester terms.
- [x] Record that no pilot is scheduled in the current execution scope.
- [x] Inventory development, staging, and production Supabase provisioning.
- [x] Record the latest applied migration in each environment.
- [x] Assign the Founder as interim feature and operational owner.

Exit gate: passed on 2026-08-04. Environment state is known, the current app scope is explicitly approved, and unverified automatic curriculum coverage is excluded from product claims.

## Phase 1: Security and data integrity

Target: 4-6 days. This blocks all later release work.

Implementation findings and deployment checks are tracked in [security-audit.md](./security-audit.md).

Status: complete for implementation and the configured development environment on 2026-08-04. Staging and production deployment verification remains part of Phase 8 because those environments are not provisioned.

- [x] Audit every existing action and API route for authentication and resource ownership.
- [x] Test horizontal privilege escalation across the existing user-owned models.
- [x] Validate admin authorization and audit admin mutations.
- [x] Verify development Supabase Storage behavior and Postgres row-level security.
- [x] Rate-limit every existing costly or abuse-sensitive endpoint, including Support and Feedback submission flows.
- [x] Validate file signatures, MIME types, extensions, sizes, and safe download headers.
- [x] Sanitize provider errors and delimit untrusted material content.
- [x] Add security headers and a Content Security Policy.
- [x] Implement privacy-minimized account export and retryable account deletion.
- [x] Test prompt injection from uploaded content.

Exit gate: passed locally on 2026-08-04. Authorization tests pass, costly routes are bounded, development storage and database controls are verified, and reviewed provider errors cannot reach clients. Repeat the environment checks in staging and production during Phase 8.

## Phase 2: Automated tests and CI

Target: 5-7 days.

Status: implementation complete locally. The local quality gate passes with 19 test files and 51 tests. GitHub Actions run #9 passed `Quality`; its browser job stopped at database security verification before the Support and Feedback RLS correction. That migration has been corrected and later local migrations add material de-duplication, semester archival, and goal progress history. Browser CI must be rerun after the current branch is pushed. Branch protection on `main` was explicitly deferred by the Founder on 2026-08-05. See [testing.md](./testing.md) for commands, isolation rules, and CI details.

- [x] Add Vitest for schemas and business logic.
- [x] Add React Testing Library for interactive components.
- [x] Add Playwright for critical journeys.
- [x] Create an isolated test database strategy.
- [x] Add CI for lint, TypeScript, tests, migration validation, and production build.
- [x] Cover planner collisions, timetable parsing, task expiry, reminders, goals, CWA, diagnostics, retrieval, and AI context.
- [x] Cover signup/onboarding, semesters, tasks, planner, materials/AI, diagnostics, peers, notifications, and admin journeys.
- [x] Add explicit cross-account rejection tests.
- [x] Confirm the first isolated GitHub browser run passes.
- [ ] Require the `Quality` and `Browser journeys` checks in branch protection. Deferred by Founder decision on 2026-08-05.

Exit gate: branch-protection activation is deferred, and browser CI still needs a rerun after the current pushed state. Local lint, TypeScript, 51 automated tests, Prisma validation, and the production build pass. `npm run test:e2e` is currently blocked locally because `.env.test.local` is not configured. The prior isolated browser run passed all 9 journeys without retries.

## Phase 3: Complete product UX

Target: 3-5 days.

Status: mostly complete on 2026-08-05. Support and Feedback now persist authenticated submissions, help content is searchable, administrator review exists, root and route error recovery is available, and main student, peer, notification, AI, diagnostic, and admin mutation flows expose pending states. Archived academic views now show read-only recovery messaging.

- [x] Replace Support with searchable help and a tracked request flow.
- [x] Replace Feedback with validated persistence and a user-facing submission flow; admin review remains.
- [x] Add global and route-level error boundaries and a useful not-found page.
- [x] Add pending submit states to onboarding, profile, goals, planner, notifications, tasks, support, and feedback.
- [x] Standardize the critical empty, loading, error, read-only, and recovery states across student workflows.
- [x] Prevent duplicate submissions on important mutation forms and confirm destructive actions consistently.
- Complete mobile, keyboard, focus, label, landmark, contrast, and reduced-motion reviews.
- [x] Explain unavailable AI and OCR integrations clearly.
- [x] Add bounded AI provider timeout and retry recovery for chat and diagnostics.

Exit gate: code-level placeholder routes are removed and critical routes have deliberate empty/failure/recovery states. Full manual mobile and accessibility review remains before launch.

## Phase 4: Academic workflow hardening

Target: 5-8 days.

- Verify CWA, weighted assessment, attendance, and incomplete-result rules against KNUST policy.
- Validate impossible scores, weights, dates, and timetable ranges.
- [x] Define semester archival, deletion, and historical read-only behavior.
- [x] Complete task editing and consistent status behavior.
- [x] Test deadlines and reminders in the Africa/Accra timezone.
- Detect timetable and study-session conflicts.
- [x] Make plan regeneration non-destructive and idempotent.
- [x] Evaluate OCR parsing against representative KNUST timetable text fixtures.
- [x] Verify automatic goal metrics and progress-history semantics.

Progress on 2026-08-05: task dates and reminder ordering, assessment dates, assessment weight totals, study-plan date ranges, semester date ranges, and timetable time ranges now have explicit validation. Assessment averages now use recorded weights when all relevant results have weights, with a safe unweighted fallback. Timetable generation rejects overlapping imported class rows, manual timetable blocks reject same-day overlaps, and generated study-plan replacement is atomic while preserving manual sessions. Semester archival is implemented as read-only history with a reopen path. Task transitions now cover TODO, IN_PROGRESS, DONE, ARCHIVED, and effective EXPIRED behavior. Africa/Accra date helpers and tests cover local date/datetime and week boundaries. Goal progress snapshots are stored when academic/task/planner changes move a metric.

Exit gate: local implementation and tests pass. Remaining launch work is external KNUST policy verification for final CWA/attendance rules and image-based OCR evaluation with real timetable screenshots.

## Phase 5: AI, diagnostics, and materials

Target: 5-8 days.

- Build a course-specific AI and diagnostic evaluation set.
- Show materials or topics used to ground answers.
- Prefer an explicit insufficient-material response over unsupported claims.
- Add timeouts, retries, cancellation, and provider-failure recovery.
- Track per-user AI usage, latency, failures, tokens, and cost.
- Apply quotas across every generative endpoint.
- Test academic-integrity and prompt-injection safeguards.
- Add diagnostic validation and student quality feedback.
- Add failed-ingestion reprocessing, duplicate handling, and content versioning.
- Review source and permission metadata for platform materials.

Progress on 2026-08-05: course material records now carry a SHA-256 content hash, repeated READY/PENDING uploads are rejected or ignored, and FAILED records remain retryable. Material versioning, ingestion job tracking, and AI usage accounting remain.

Exit gate: quality thresholds are met, AI cost is bounded, and failed ingestion is recoverable.

## Phase 6: Curriculum and admin operations

Target: 1-3 weeks for initial coverage; ongoing afterward.

- Import and verify every course in the approved launch scope.
- Version curriculum by academic year.
- Handle electives, exclusions, renamed courses, and course-code changes.
- Add import preview, validation, and rollback.
- Add admin search, filters, pagination, and bulk operations.
- Add immutable audit records for catalogue, topic, and material changes.
- Add a student-facing content-correction workflow.
- Verify imported materials using the existing import-report scripts.

Progress on 2026-08-05: administrators can now review and update Support and Feedback statuses from `/admin/feedback`. Curriculum import preview, versioning, rollback, pagination, and student content-correction workflows remain.

Exit gate: advertised coverage is verified and administrator changes are attributable and reversible.

## Phase 7: Notifications and background jobs

Target: 3-5 days.

- Generate reminders in scheduled background jobs rather than browser activity.
- Keep notification generation idempotent with stable source keys.
- Cover tasks, study sessions, goals, peer answers, and group updates.
- Define in-app, email, and push scope.
- Add retention, cleanup, delivery-failure tracking, and preference tests.

Progress on 2026-08-05: an authenticated scheduled notification endpoint now synchronizes up to 1,000 active users using the existing stable source keys and duplicate-safe inserts. A deployment scheduler and `CRON_SECRET` remain intentionally unconfigured until Phase 8 infrastructure approval.

Exit gate: reminders work while users are offline, duplicates are prevented, and preferences suppress all relevant delivery paths.

## Phase 8: Production infrastructure

Target: 3-5 days.

- Configure isolated staging and production services.
- Document pooled and direct database connections.
- Establish safe migration deployment.
- Enable backups and complete a test restore.
- Add structured logs, request correlation, error monitoring, and release tracking.
- Add uptime and critical-API checks.
- Track AI and OCR reliability and cost.
- Add privacy-conscious activation analytics.
- Define retention for conversations, uploads, notifications, and logs.
- Write incident, rollback, restore, and secret-rotation runbooks.

Exit gate: staging passes, monitoring captures a test failure, a restore succeeds, and rollback is rehearsed.

## Phase 9: Pilot and launch

Target: 2-3 weeks elapsed time.

- Run an internal alpha across empty, normal, large, mobile, and slow-network scenarios.
- Pilot with 10-25 students for two academic weeks.
- Measure onboarding, semester setup, first task, timetable import, plan generation, AI usefulness, diagnostic completion, week-two retention, and support volume.
- Resolve every severity-1 and severity-2 issue.
- Publish privacy, terms, academic-integrity, support, and data-handling policies.
- Assign launch monitoring, support, incident, and release ownership.

Exit gate: no launch blocker remains, at least 90% of pilot users complete critical workflows without assistance, and product claims match actual coverage.

## Environment matrix

| Environment | Purpose | Data policy | Status |
| --- | --- | --- | --- |
| Development | Local implementation | Synthetic or developer-owned data only | Configured database verified at all 32 migrations on 2026-08-04; current branch contains 35 migrations pending full environment replay |
| Staging | Release candidate verification | Synthetic pilot-like data; no production secrets | Not provisioned |
| Production | Student use | Real student data under a published retention policy | Not provisioned |

Required configuration is documented in `.env.example`. Service-role keys, direct database credentials, and AI keys are server-only and must never use the `NEXT_PUBLIC_` prefix.

## Recommended schedule

| Week | Focus |
| --- | --- |
| 1 | Baseline, security, and data integrity |
| 2-3 | Automated tests and CI |
| 4 | Support, feedback, errors, and accessibility |
| 5-6 | Academic, planner, goal, and OCR hardening |
| 7 | AI, diagnostics, and material ingestion |
| 8 | Notifications, observability, and deployment |
| 9-10 | Internal alpha and defect resolution |
| 11-12 | Student pilot and launch decision |

The critical path is **security -> tests -> workflow hardening -> production infrastructure -> pilot**. New feature expansion should not displace it.

## Release checklist

- [x] Launch scope approved.
- [x] Environment and migration inventory complete.
- [x] Phase 1 security implementation and development exit gate passed.
- [ ] Staging and production security deployment checks passed.
- [x] Automated testing implementation passed locally.
- [x] No placeholder routes remain.
- [ ] Accessibility and mobile review passed.
- [ ] Academic calculation rules verified against external KNUST policy.
- [ ] AI quality and cost thresholds met.
- [ ] Curriculum launch coverage verified.
- [ ] Background reminders proven.
- [ ] Backup restore and rollback rehearsed.
- [ ] Legal and support materials published.
- [ ] Pilot exit gate passed.
- [ ] Production launch approved.
