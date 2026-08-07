# BRAIL Security Audit

Last updated: 2026-08-05.

Status: Phase 1 implementation and development-environment verification are complete. Staging and production security deployment checks remain release gates because those environments are not provisioned.

## Authorization and data isolation

- All reviewed Server Actions and route handlers authenticate through `requireAppUser`, `requireAdmin`, or an equivalent route-level session check.
- Task, academic, assessment, goal, planner, conversation, notification, material, diagnostic, peer-group, peer-Q&A, study-plan, and download operations constrain user-owned records by the signed-in application user.
- Automated cross-account tests exercise destructive operations across the existing user-owned models and verify that a foreign resource ID remains constrained by the current user and active semester.
- Administrator role grants and revocations require an administrator, create an audit record, reject deleted targets, and prevent removal of the final administrator.
- Student-created courses remain private until administrator approval; official catalogue records remain global.
- Archived semesters remain readable but reject academic, task, planner, assessment, goal, material, and timetable mutations until reopened.
- Every Prisma-managed public application table has RLS enabled. Direct table privileges are revoked from Supabase `anon` and `authenticated` browser roles.
- The `course-materials` bucket is private. Material access uses a server-side ownership check followed by a short-lived signed URL.

## Input, provider, and abuse controls

- AI chat, diagnostics, OCR, study-plan generation, uploads, notification polling, and account deletion use database-backed per-user limits. Buckets older than seven days are removed opportunistically.
- Support and Feedback expose authenticated submission endpoints with validation, persistence, administrator review, and per-user rate limiting.
- Material and timetable uploads validate extensions, declared MIME types, file sizes, and leading file signatures.
- Material parser, storage, AI provider, and OCR failures are logged server-side and return generic client messages.
- Retrieved material is explicitly delimited as untrusted data in AI and diagnostic prompts. Automated tests verify that prompt-injection text remains inside the data boundary.
- Application-wide CSP, frame, MIME-sniffing, referrer, and permissions headers are configured.
- The dependency audit reports zero known vulnerabilities after upgrading Next.js and `eslint-config-next` to 16.3.0.

## Account lifecycle and privacy

- Students can download a JSON export before deletion.
- Exports include only the student's own diagnostic attempts and aggregate counts for other users' peer/group activity.
- Deletion removes private academic records in a transaction, anonymizes peer content that must remain for conversation integrity, and records a non-identifying tombstone.
- Storage and Supabase Auth cleanup are independently tracked and retryable. An administrator can retry unfinished external cleanup without restoring the deleted account.
- AI conversations, private materials, and generated diagnostics remain user-controlled and are deleted with the account. Security and operational rate-limit records use a seven-day retention window and do not store prompt or material bodies.

## Verification evidence

Completed against the configured development environment on 2026-08-04, with local application checks rerun on 2026-08-05:

- All 32 Prisma migrations applied at the Phase 1 checkpoint; the configured development database now contains 48 migrations and they must be replayed in isolated staging before release.
- Database verifier found zero public application tables without RLS and zero direct `anon` or `authenticated` table grants.
- A temporary private object could not be listed or downloaded by either an anonymous client or a temporary ordinary authenticated client. The object and temporary Auth user were removed by the verifier.
- Current Vitest suite: 35 files and 101 tests pass, including security regression coverage.
- ESLint and TypeScript validation passed.
- `npm audit` reported zero vulnerabilities.

Repeatable commands:

```text
npm run test:security
npm run security:database
npm run lint
npx tsc --noEmit --incremental false
npm audit --audit-level=high
```

## Deferred release verification

- Provision isolated staging and production services during Phase 8, apply every migration, and rerun the database/storage verifier in each environment.
- Exercise OAuth redirects and Supabase requests under the deployed CSP.
- Confirm backups, perform a restore test, and rehearse rollback before production use.
- Add the existing security tests to required CI checks during Phase 2.
