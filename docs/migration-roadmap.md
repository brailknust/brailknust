# BRAIL Migration Roadmap

This rebuild keeps the old app's product interfaces, but removes static sample data until each feature is backed by Supabase and Prisma.

For the product north star, see [product-context.md](./product-context.md).

## Current Foundation

- Stack: Next.js, TypeScript, Tailwind CSS, Supabase Auth/Postgres, Prisma.
- Auth: Google sign-in and email/password through Supabase.
- Profile: onboarding and profile editing store KNUST college, programme, mapped department, level, CWA, academic year, and active semester.
- Academics: semester cards, semester detail pages, courses, enrollments, course analytics, timetable blocks.
- Tasks: create tasks, attach optional courses, update status.
- Planner: local OCR timetable extraction, editable timetable rows, preference-based study-plan generation, saved plan items.
- Curriculum seed: Computer Engineering, Level 100, First Semester.

## Feature Migration Status

| Feature | Old route | New route | Data needed | Tables involved | Status |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | `/dashboard` | profile, active semester, enrollments, tasks, timetable | `users`, `semesters`, `enrollments`, `courses`, `tasks`, `timetable_blocks` | Migrated |
| Academic setup | `/semester` | `/academics` | active semester, CWA, courses, timetable | `users`, `semesters`, `courses`, `enrollments`, `timetable_blocks`, `semester_profiles` | Migrated |
| Tasks | Old planner sections | `/tasks` | tasks, course links, statuses | `tasks`, `courses` | Migrated |
| Study planner | `/planner`, `/study-planner` | `/planner` | active semester courses, open tasks, OCR rows, preferences, generated plan items | `study_plans`, `study_plan_items`, `tasks`, `courses`, `timetable_blocks` | Migrated |
| AI chat | `/ai-chat` | `/ai-chat` | prompts, responses, academic context | `ai_chats`, plus contextual academic tables | Placeholder |
| Performance | `/performance` | `/performance` | CWA, grades, attendance, weak areas | `users`, `enrollments`, `weak_areas`, `courses` | Placeholder |
| Goals | `/goals` | `/goals` | goal title, category, progress, target, deadline | New `goals` table needed | Placeholder |
| Peer support | `/peers` | `/peers` | study groups, members, course matching | `study_groups`, `study_group_members`, `courses`, `users` | Placeholder |
| Profile | `/profile` | `/profile` | editable user profile and academic placement | `users`, `semesters`, `semester_profiles` | Migrated |
| Support | `/support` | `/support` | help content or support requests | New support model optional | Placeholder |
| Feedback | `/feedback` | `/feedback` | feedback text, user, status | New `feedback` table optional | Placeholder |

## Next Migration Steps

1. Harden Planner OCR with real timetable samples from KNUST students and tune parser edge cases.
2. Build Performance from existing enrollment grades, attendance, confidence scores, study sessions, tasks, and weak areas.
3. Add weak-area capture/editing so Performance and future AI can recommend specific study actions.
4. Build Goals with a dedicated Prisma model and connect goals to CWA, study hours, tasks, and course performance.
5. Build Peer Support study groups for active-semester courses: create groups, join/leave, member counts.
6. Add peer matching after groups work, using shared courses/programme/level rather than sample people.
7. Build AI Chat with saved `ai_chats` history and scoped academic context from active semester data.
8. Replace Support placeholder with static help content first; only add a support-request table if needed.
9. Replace Feedback placeholder with a saved feedback form and admin-review status if needed.
