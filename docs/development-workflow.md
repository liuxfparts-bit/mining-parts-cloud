# KuangPeiYun Development Workflow

## Development flow

All normal development work should use:

feature branch
→ GitHub CI
→ Pull Request
→ review / staging verification
→ merge to main
→ production deployment

## Branch rules

- `main` represents production-ready code.
- Normal development must not be performed directly on `main`.
- New work should use `feature/*` branches.
- Every feature branch must pass KuangPeiYun CI.
- Database migrations must pass the PostgreSQL migration gate.
- Production deployment remains a manual operation.

## Environment separation

Production:
- Production application
- Production PostgreSQL
- Production data

Staging:
- Isolated application
- Isolated PostgreSQL
- Isolated Docker volume
- Smoke testing before production

CI:
- Temporary PostgreSQL
- Prisma migration validation
- Legacy relation guard
- Production build validation
