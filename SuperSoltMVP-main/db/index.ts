import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// SECURITY NOTE: Using ssl: { rejectUnauthorized: false } disables certificate verification.
// This is a security vulnerability as it makes the connection susceptible to MITM attacks.
// For production, use proper SSL certificate verification or remove the ssl option entirely
// if your database provider handles SSL correctly (like Neon does by default).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export const db = drizzle(pool, { schema })
