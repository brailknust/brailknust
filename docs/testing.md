# Testing BRAIL

Phase 2 uses a layered release gate: fast Vitest checks protect business rules and components, while Playwright drives authenticated journeys against an isolated Supabase environment.

## Test layers

| Layer | Command | Coverage |
| --- | --- | --- |
| Unit and integration | `npm test` | Schemas, task expiry, planner collisions, timetable parsing, goals, notifications, retrieval, AI context, material chunking, and cross-account scope rules |
| Component | `npm run test:components` | Authentication, onboarding controls, and destructive-action confirmation |
| Coverage gate | `npm run test:coverage` | The complete `src/features` and `src/components` surface, including untested files |
| Browser journeys | `npm run test:e2e` | Signup/onboarding, admin access, semesters, tasks, planner, private materials, diagnostics, peers, groups, and notifications |
| Database security | `npm run security:database` | RLS, browser-role grants, private Storage behavior, and cross-account rejection |

Run the fast local gate with:

```text
npm run lint
npm run typecheck
npm run test:coverage
npx prisma validate
npm run build
```

## Browser environment

Use the local Supabase CLI stack for repeatable browser tests. Copy `.env.test.example` to `.env.test.local`, then fill it from `supabase status -o env`:

```text
DATABASE_URL=<DB_URL>
DIRECT_URL=<DB_URL>
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

Apply every migration before the run:

```text
npm run db:test:migrate
npm run security:database
npm run test:e2e:install
npm run test:e2e
```

The Playwright setup creates uniquely named Auth users, application users, semesters, courses, materials, diagnostics, peer records, and notifications. Global teardown removes those records and any uploaded Storage objects after both passing and failing runs.

Remote browser testing is refused by default. A disposable remote test project requires `E2E_ALLOW_REMOTE=1`; using `.env.local` also requires `E2E_USE_DEVELOPMENT_ENV=1`. Never point either option at production or a project containing real student data.

## CI gate

`.github/workflows/ci.yml` creates two pull-request checks:

- `Quality`: install, Prisma generation, lint, TypeScript, coverage, schema validation, and production build.
- `Browser journeys`: local Supabase startup, full migration replay, database security verification, production build, and Playwright.

Configure the `main` and `readyapp` branch rules in GitHub to require both checks before merge. Also require pull requests, dismiss stale approvals, and prevent bypassing the checks for administrators.

The browser job uploads its Playwright HTML report and failure attachments for 14 days. Fixtures are synthetic and local to the CI runner; no shared Supabase credentials are required.

The CI security check explicitly bootstraps the private `course-materials` bucket because Storage buckets are external to Prisma migrations. That bootstrap is rejected unless Supabase is running on localhost; normal environment verification still treats a missing bucket as a failure.

## Adding tests

Put pure logic in `tests/unit`, data-bound behavior with mocked ownership boundaries in `tests/integration`, interactive client behavior in `tests/components`, security regressions in `tests/security`, and complete user workflows in `tests/e2e`. Keep E2E data namespaced by the fixture `runId` and extend global teardown whenever a new external resource is created.
