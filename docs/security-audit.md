# BRAIL Security Audit

Last updated: 2026-08-03.

## Completed controls

- All reviewed user mutations authenticate through `requireAppUser` or equivalent route-handler checks.
- Reviewed task, academic, assessment, goal, planner, conversation, notification, material, diagnostic, peer-group, peer-Q&A, and download operations constrain user-owned records by the signed-in application user.
- Existing shared course metadata can no longer be overwritten by student-entered course or timetable data.
- Admin mutations require `requireAdmin`.
- Public-schema application tables have a migration enabling RLS and revoking direct Data API privileges from `anon` and `authenticated`.
- The private material bucket is accessed through server-side signed URLs after an ownership check.
- AI, diagnostics, OCR, study-plan generation, uploads, and notification polling have database-backed per-user limits.
- Rate-limit buckets older than seven days are removed opportunistically.
- Material uploads validate extension, declared MIME type, size, and leading file signature.
- Timetable images validate extension, MIME type, size, and leading file signature.
- Material parser and storage failures are logged server-side and sanitized for clients.
- Application-wide CSP, frame, MIME-sniffing, referrer, and permissions headers are configured.

## Deployment verification still required

- Development: all 31 Prisma migrations were applied successfully on 2026-08-03.
- Staging and production: apply all Prisma migrations, then confirm the direct Prisma role can read and write while Supabase `anon` and `authenticated` Data API requests are denied.
- Verify the `course-materials` bucket remains private and cannot be listed or downloaded with an anonymous or normal user token.
- Exercise OAuth redirects and Supabase requests under the production CSP.
- Add automated cross-account tests before declaring the ownership audit complete.
- Confirm database backups and restore behavior before production use.

## Product decisions required

The following recommended policies were approved on 2026-08-03 and now require implementation.

### Student-created courses

The `Course` model is global. Students currently may create a missing shared course record, although they can no longer modify an existing one.

Approved: add ownership and verification state so official catalogue courses are global while student-created courses are private until approved by an administrator.

### Administrator authority

An email in `ADMIN_EMAILS` is promoted to the persistent database `ADMIN` role. Removing the email later does not automatically revoke that role.

Approved: treat the database role as authoritative and use `ADMIN_EMAILS` only for initial bootstrap, with an explicit admin grant/revoke audit workflow. Prevent removal of the final administrator.

### Account deletion and retention

The application does not yet expose account deletion or data export. A deletion policy must decide whether academic records, peer contributions, support records, and aggregate analytics are deleted, anonymized, or retained.

Approved: immediately delete private academic data and stored files, anonymize peer content that has replies, retain only non-identifying operational aggregates, and provide a JSON export before deletion.

### AI and uploaded-content retention

The retention period for AI conversations, private course materials, generated diagnostics, and server logs is not defined.

Approved: retain user content until the user deletes it or their account; keep security and operational logs for 30 days with no material text or AI prompt bodies.
