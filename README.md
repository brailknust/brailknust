# BRAIL

BRAIL is an academic planning and student-support workspace for KNUST students. It combines semester and course management, tasks, timetable-aware study planning, performance tracking, grounded AI assistance, diagnostic practice, goals, peer learning, and notifications.

## Stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4
- Supabase Auth, Postgres, and Storage
- Prisma 6
- Groq-compatible AI chat completions
- Tesseract OCR for timetable images

## Local development

1. Install dependencies with `npm install`. This automatically generates the Prisma client.
2. Copy `.env.example` to `.env.local` and provide the required Supabase and database values.
3. Apply the Prisma migrations to the development database.
4. Start the app with `npm run dev`.

If Prisma reports that `@prisma/client` has not initialized, run `npx prisma generate` and restart the development server.

Authenticated academic flows require Supabase and Postgres. AI features additionally require `GROQ_API_KEY`.

## Verification

```text
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Authenticated browser journeys and database migration replay use an isolated Supabase test environment. See [Testing BRAIL](docs/testing.md) for setup, commands, data-safety rules, and CI checks.

Deterministic quality checks are available with `npm run evaluate:ai` and `npm run evaluate:ocr`. Development material provenance can be summarized with `npm run verify:materials:provenance`; see [Evaluation](docs/evaluation.md) for scope and remaining external evidence.

## Documentation

- [Product context](docs/product-context.md)
- [Release baseline](docs/release-baseline.md)
- [Completion roadmap](docs/migration-roadmap.md)
- [Security audit](docs/security-audit.md)
- [Testing](docs/testing.md)
- [Deployment](docs/deployment.md)

Use separate Supabase projects and credentials for development, staging, and production. Never commit `.env.local`, database credentials, service-role keys, or AI keys.
