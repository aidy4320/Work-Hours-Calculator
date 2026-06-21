# Work Hours Calculator

A cloud-based, multi-user time tracking application for freelancers and self-employed
contractors. Users register a personal account, log in securely from any device, track their
daily work hours, and monitor progress toward a monthly hour target. The app sends in-app and
email notifications (behind-target warnings, reminders, goal-achieved, and monthly summaries).

## Status

Early development. The project follows **Spec-Driven Development (SDD)**:

| Phase | Document | Description |
|-------|----------|-------------|
| Specify | [SPEC.md](docs/SPEC.md) | What & why — requirements, user stories, edge cases |
| Plan | [PLAN.md](docs/PLAN.md) | How — architecture, data model, tech stack |
| Tasks | [TASKS.md](docs/TASKS.md) | Ordered, numbered implementation tasks with dependencies |

## Tech Stack (planned)

- **Frontend:** React 18 + TypeScript (Vite)
- **Backend:** Supabase (managed Postgres, Auth, Edge Functions, Row Level Security)
- **Email:** Transactional provider (e.g. Resend / SendGrid)
- **Languages:** TypeScript + SQL

See [PLAN.md](docs/PLAN.md) for the full architecture and rationale.

## Getting Started

> Setup instructions will be added as the project is scaffolded (see TASK-01 in [TASKS.md](docs/TASKS.md)).

## License

Private — all rights reserved.
