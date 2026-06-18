# CLAUDE.md

## Project overview
- This repository is a service desk monorepo with a Fastify API in `apps/api` and shared schemas/utilities in `packages/shared`.
- The current implementation focuses on Sprint 1 and the early part of Sprint 2.
- Keep changes aligned with the plan in `SERVICE_DESK_PLAN.md` and the checklist in `SPRINTS_CHECKLIST.md`.

## Coding rules
- Prefer typed TypeScript code and keep request/response models explicit.
- Reuse shared Zod schemas from `packages/shared` for validation whenever possible.
- Add integration tests for new API behavior using `app.inject()`.
- Use `AppError` for business/domain errors and let the central error handler return consistent responses.
- Do not introduce unnecessary dependencies.

## API conventions
- All new routes should define schema metadata for request/response shapes where applicable.
- Keep auth flows consistent: JWT access token in `Authorization`, refresh token in `httpOnly` cookie.
- Use the same error response shape for validation and authorization failures.

## Testing expectations
- Before claiming success, run:
  - `pnpm --filter @service-desk/api test`
- If you change API behavior, add or update tests in `apps/api/src/__tests__`.

## Git workflow
- Keep commits small and meaningful.
- Update `SPRINTS_CHECKLIST.md` when progress changes.
- Do not leave unrelated files untracked.
