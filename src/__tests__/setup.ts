import { config } from "dotenv";
import path from "path";

// Load test environment variables from .env.test
config({ path: path.resolve(process.cwd(), ".env.test") });

// Validate required test env vars are present when running integration tests
const INTEGRATION_ENV_VARS = ["SUPABASE_TEST_URL", "SUPABASE_TEST_ANON_KEY"];

const missing = INTEGRATION_ENV_VARS.filter(
  (key) =>
    !process.env[key] ||
    process.env[key]!.startsWith("your-") ||
    process.env[key]!.startsWith("https://your-"),
);

if (missing.length > 0 && process.env.RUN_INTEGRATION_TESTS === "true") {
  throw new Error(
    `Missing or placeholder test env vars: ${missing.join(", ")}\n` +
      "See docs/testing/INTEGRATION_TESTS.md for setup instructions.",
  );
}
