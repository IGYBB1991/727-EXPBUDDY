# Household Expenses Tracker

A web app for our household's spending. We upload bank and credit card
statements (CSV or PDF), Claude sorts each transaction into a category, and a
dashboard shows where the money goes each month, with Food first.

Built with Next.js, Supabase (database and Google sign-in) and Claude.
It's being built step by step. Full setup instructions for Supabase, Google
sign-in, the Claude API key and Vercel will be added in the final step.

## Running the checks

```bash
npm install
npm test          # unit tests
npm run lint
npm run build
```

Database tests run against a local Postgres when `TEST_DATABASE_URL` is set,
for example `TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test`.
