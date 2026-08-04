# BRAIL Completion Roadmap

This is the canonical plan for taking BRAIL from its current implementation to production. See [product-context.md](./product-context.md) for the product north star.

## Current baseline

Last verified: 2026-08-04.

- Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, Supabase, Prisma, and Postgres.
- `npm run lint`, TypeScript validation, and `npm run build` pass; the build generates 32 pages/routes.
- Authentication, onboarding, academics, tasks, planner, performance, goals, AI chat, diagnostic practice, peers, notifications, and admin content tooling are implemented.
- Support and Feedback remain explicit placeholders.
- No automated tests, CI workflow, or application error boundaries are configured.
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

- Audit every action and API route for authentication and resource ownership.
- Test horizontal privilege escalation across every user-owned model.
- Validate admin authorization and audit admin mutations.
- Review Supabase Storage policies and Postgres row-level security.
- Rate-limit AI, diagnostic, OCR, upload, notification, support, and feedback endpoints.
- Validate file signatures, MIME types, extensions, sizes, and safe download headers.
- Sanitize provider errors and untrusted material content.
- Add security headers and a Content Security Policy.
- Define account deletion and data export.
- Test prompt injection from uploaded content.

Exit gate: authorization tests pass, costly routes are bounded, storage policies are verified, and sensitive errors cannot reach clients.

## Phase 2: Automated tests and CI

Target: 5-7 days.

- Add Vitest for schemas and business logic.
- Add React Testing Library for interactive components.
- Add Playwright for critical journeys.
- Create an isolated test database strategy.
- Add CI for lint, TypeScript, tests, migration validation, and production build.
- Cover planner collisions, timetable parsing, task expiry, reminders, goals, CWA, diagnostics, retrieval, and AI context.
- Cover signup/onboarding, semesters, tasks, planner, materials/AI, diagnostics, peers, notifications, and admin journeys.
- Add explicit cross-account rejection tests.

Exit gate: every critical journey has a passing browser test and pull requests cannot merge with failed checks.

## Phase 3: Complete product UX

Target: 3-5 days.

- Replace Support with searchable help and a tracked request flow.
- Replace Feedback with validated, rate-limited persistence and admin review.
- Add global and route-level error boundaries and a useful not-found page.
- Standardize empty, loading, error, and success states.
- Prevent duplicate submissions and confirm destructive actions.
- Complete mobile, keyboard, focus, label, landmark, contrast, and reduced-motion reviews.
- Explain unavailable AI and OCR integrations clearly.

Exit gate: no navigation item leads to a placeholder and every route has deliberate empty and failure states.

## Phase 4: Academic workflow hardening

Target: 5-8 days.

- Verify CWA, weighted assessment, attendance, and incomplete-result rules against KNUST policy.
- Validate impossible scores, weights, dates, and timetable ranges.
- Define semester archival, deletion, and historical read-only behavior.
- Complete task editing and consistent status behavior.
- Test deadlines and reminders in the Africa/Accra timezone.
- Detect timetable and study-session conflicts.
- Make plan regeneration non-destructive and idempotent.
- Evaluate OCR against representative KNUST timetable images.
- Verify automatic goal metrics and progress-history semantics.

Exit gate: academic rules are documented and tested and planner operations cannot silently destroy work.

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

Exit gate: advertised coverage is verified and administrator changes are attributable and reversible.

## Phase 7: Notifications and background jobs

Target: 3-5 days.

- Generate reminders in scheduled background jobs rather than browser activity.
- Keep notification generation idempotent with stable source keys.
- Cover tasks, study sessions, goals, peer answers, and group updates.
- Define in-app, email, and push scope.
- Add retention, cleanup, delivery-failure tracking, and preference tests.

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
| Development | Local implementation | Synthetic or developer-owned data only | Configured database verified at all 31 migrations on 2026-08-04 |
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
- [ ] Security exit gate passed.
- [ ] Automated testing exit gate passed.
- [ ] No placeholder routes remain.
- [ ] Accessibility and mobile review passed.
- [ ] Academic calculation rules verified.
- [ ] AI quality and cost thresholds met.
- [ ] Curriculum launch coverage verified.
- [ ] Background reminders proven.
- [ ] Backup restore and rollback rehearsed.
- [ ] Legal and support materials published.
- [ ] Pilot exit gate passed.
- [ ] Production launch approved.
