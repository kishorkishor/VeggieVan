# Contributing

Thanks for taking the time to contribute to Rype.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local`.
3. Configure `AUTH_SECRET` and `DATABASE_URL`.
4. Run `npm run db:push` and `npm run db:seed`.
5. Start the app with `npm run dev`.

## Before opening a pull request

Run the same checks used in CI:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run e2e
```

Please keep pull requests focused, describe the user-facing change, and include screenshots for visible UI changes.
