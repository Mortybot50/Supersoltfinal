# Integration Testing with Supabase

Integration tests hit a real Supabase database to catch issues that unit tests miss
(broken migrations, RLS policy gaps, constraint violations, etc.).

## Setup

### 1. Create a dedicated Supabase test project

Create a **separate** Supabase project for testing — never point tests at production or staging.

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it something like `supersolt-test` or `supersolt-ci`
3. Once provisioned, go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefghijkl.supabase.co`)
   - **anon public** key

### 2. Apply migrations to the test project

```bash
# Point the Supabase CLI at your test project
supabase link --project-ref <your-test-project-ref>

# Push all migrations
supabase db push
```

Alternatively, run the SQL files in `supabase/migrations/` manually via the Supabase SQL editor
in the order they appear (files are named chronologically).

### 3. Configure .env.test

Copy the placeholder file and fill in your test project credentials:

```bash
cp .env.test .env.test.local   # optional: use .env.test.local for personal overrides
```

Edit `.env.test`:

```
SUPABASE_TEST_URL=https://your-test-project-ref.supabase.co
SUPABASE_TEST_ANON_KEY=your-test-anon-key
```

`.env.test` is gitignored — never commit real credentials.

### 4. Run integration tests

```bash
# Run all tests (unit + integration)
RUN_INTEGRATION_TESTS=true npm test

# Run only integration tests
RUN_INTEGRATION_TESTS=true npx vitest run src/__tests__/integration/

# Run unit tests only (no Supabase required)
npm test
```

## Writing Integration Tests

Place integration tests in `src/__tests__/integration/`. Import the test Supabase client:

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_ANON_KEY!,
);
```

Guard tests so they're skipped when credentials aren't configured:

```ts
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!integrationEnabled)("qualification_types RLS", () => {
  it("non-admin cannot insert", async () => {
    // ...
  });
});
```

## CI/CD

To run integration tests in CI, add these secrets to your CI environment:

| Secret name              | Value                 |
| ------------------------ | --------------------- |
| `SUPABASE_TEST_URL`      | Test project URL      |
| `SUPABASE_TEST_ANON_KEY` | Test project anon key |

Then set `RUN_INTEGRATION_TESTS=true` in the CI step that runs tests.

## Test Project Maintenance

- Run `supabase db push` against the test project after every new migration
- Reset the test DB between test runs if tests are stateful: `supabase db reset --linked`
- Keep the test project's schema in sync with `supabase/migrations/` — treat it like a staging DB
