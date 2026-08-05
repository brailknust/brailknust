# BRAIL Release Baseline

Last verified: 2026-08-05.

This document records the approved Phase 0 release scope, feature classification, environment inventory, and interim ownership. It describes what BRAIL supports now without treating future curriculum coverage or delivery infrastructure as already available.

Verification on 2026-08-05: ESLint passed, TypeScript passed with no emitted files, 51 Vitest tests passed, Prisma schema validation passed, and the production build passed with 34 generated pages/routes. The Phase 1 database verifier previously confirmed 32 applied development migrations on 2026-08-04; the current branch now contains 35 migrations that must be replayed in staging before release.

## Approved initial scope

- Institution: Kwame Nkrumah University of Science and Technology (KNUST).
- Student profiles: the colleges, departments, and programmes represented in the current KNUST academic hierarchy.
- Academic levels: Level 100 through Level 600.
- Semester terms: First Semester and Second Semester.
- Academic years: user-entered in `YYYY/YYYY` format.
- Product surface: the currently implemented authenticated student and administrator workflows listed below.
- Pilot: no pilot is scheduled in the current execution scope. Pilot or an alternative real-user validation plan remains a separate Phase 9 launch decision.

### Curriculum coverage

The app can onboard students from the current KNUST hierarchy and allows students to configure semesters and courses manually. Automatic curriculum setup is narrower:

- Computer Engineering, Level 100, First Semester.
- Computer Engineering, Level 100, Second Semester.
- Computer Engineering, Level 200, First Semester.
- Computer Engineering, Level 200, Second Semester.

Other programmes and levels must not be advertised as having verified automatic course catalogues until their curricula pass the Phase 6 import and verification process.

## Feature baseline

`Launch-critical` features must pass their roadmap exit gates before production launch. `Beta` features may launch with clearly bounded behavior after their critical security and reliability checks pass. `Post-launch` features are not required for the first production release.

| Feature area | Classification | Current status | Acceptance criterion | Interim owner |
| --- | --- | --- | --- | --- |
| Authentication and onboarding | Launch-critical | Implemented; automated coverage pending | A new KNUST student can sign up, complete a profile, create an active semester, and reach the dashboard without developer intervention. | Founder |
| Profile, export, and account deletion | Launch-critical | Implemented; retry and privacy regression tests pass | A student can update a profile, export account data, and complete a recoverable, policy-compliant deletion flow. | Founder |
| Semesters, courses, and enrolment | Launch-critical | Implemented; archival and authorization tests pass locally | Students can manage only their own academic records and can use manual setup when no verified curriculum exists. | Founder |
| Tasks and deadlines | Launch-critical | Implemented; editing, status, and reminder rule tests pass locally | Students can create, edit, complete, and delete tasks with correct overdue and reminder behavior. | Founder |
| Timetable, OCR, and study planner | Launch-critical | Implemented; collision and parser tests pass locally; real-image OCR evaluation pending | Students can import or enter a timetable, correct extracted data, and generate a non-destructive study plan. | Founder |
| Assessments, performance, and CWA | Launch-critical | Implemented; weighted assessment validation passes locally; external KNUST rule verification pending | Scores and calculations reject impossible input and match documented KNUST rules. | Founder |
| Course materials and grounded AI | Launch-critical | Implemented; quality and failure evaluation pending | Answers respect course scope, disclose useful grounding, bound cost, and fail safely when evidence or providers are unavailable. | Founder |
| Diagnostic practice | Launch-critical | Implemented; generated-question validation pending | Students can generate, complete, and review valid course-scoped diagnostics without unsupported questions. | Founder |
| Goals and progress | Beta | Implemented; progress snapshots added locally; reset policy pending | Metrics have documented sources, predictable reset rules, and explainable progress updates. | Founder |
| In-app and browser notifications | Launch-critical | Implemented; background generation pending | Required reminders are generated without foreground browser activity, remain idempotent, and respect preferences. | Founder |
| Peer questions and study groups | Beta | Implemented; moderation and test coverage pending | Membership and content operations enforce ownership, privacy, deletion, and abuse rules. | Founder |
| Administrator catalogue and content tools | Launch-critical | Implemented; broader audit and rollback pending | Authorized administrators can manage verified launch content with attributable and reversible changes. | Founder |
| Support | Launch-critical | Implemented with searchable help, persistence, rate limiting, and admin review | Students can find help and submit a tracked, rate-limited support request. | Founder |
| Feedback | Launch-critical | Implemented with validation, persistence, rate limiting, and admin review | Students can submit categorized, privacy-safe, rate-limited feedback for administrator review. | Founder |
| Email and push delivery | Post-launch | Not implemented | Delivery is added only after background in-app notification generation is reliable and observable. | Founder |

## Environment and migration inventory

No credentials or project identifiers are recorded in this document.

| Environment | Provisioning | Data policy | Latest migration | Verification status | Interim owner |
| --- | --- | --- | --- | --- | --- |
| Development | Configured through local `.env.local` | Synthetic or developer-owned data only | `20260805170000_archive_semesters_and_goal_progress` (35 total migrations in branch) | Prisma schema validation, lint, typecheck, 51 tests, and production build passed on 2026-08-05. Full database replay remains required in staging. | Founder |
| Staging | Not provisioned | Synthetic pilot-like data; no production secrets | Not applicable | Create and verify before release-candidate testing. | Founder |
| Production | Not provisioned | Real student data only after policies and controls are approved | Not applicable | Create and verify before accepting real student data. | Founder |

Environment-specific credentials must remain outside the repository. Required variable names and server/client boundaries are documented in `.env.example`.

## Interim ownership

The Founder is the temporary directly responsible owner until responsibilities are delegated.

| Responsibility | Interim owner | Handoff requirement |
| --- | --- | --- |
| Product scope and release approval | Founder | Record the new owner and approval authority before delegation. |
| Engineering and deployments | Founder | Document repository, environment, migration, and rollback access. |
| Security and privacy | Founder | Document incident, deletion, retention, and secret-rotation responsibilities. |
| Curriculum and course content | Founder | Document source verification and content-correction responsibilities. |
| Student support and feedback | Founder | Document response expectations and escalation paths. |
| Monitoring and incident response | Founder | Document alert ownership, severity levels, and recovery procedures. |

## Phase 0 exit record

Phase 0 is complete when this baseline remains linked from the canonical roadmap and the following facts remain true:

- The implemented feature surface and automatic curriculum limits are explicit.
- Every feature has a classification, status, acceptance criterion, and interim owner.
- Development, staging, and production provisioning states are recorded.
- The latest development migration is verified without exposing credentials.
- Staging and production are explicitly recorded as not provisioned.
- The current decision not to schedule a pilot is recorded without silently removing Phase 9 validation from the launch roadmap.
