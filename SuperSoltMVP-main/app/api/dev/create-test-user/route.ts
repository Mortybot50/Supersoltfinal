export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, organisations, memberships, venues } from "@/db/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

/**
 * DEV ONLY: Create a test user with password for e2e testing
 * GET /api/dev/create-test-user
 */
export async function GET() {
  try {
    const testEmail = "test@dev.local";
    const testPassword = "password123";
    const testName = "Test User";

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, testEmail),
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Test user already exists",
        email: testEmail,
        password: testPassword,
        userId: existing.id,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: testEmail,
        name: testName,
        password_hash: passwordHash,
      })
      .returning();

    // Create organization
    const [org] = await db
      .insert(organisations)
      .values({
        name: "Test Organization",
      })
      .returning();

    // Create membership
    await db.insert(memberships).values({
      userId: user.id,
      orgId: org.id,
      role: "owner",
    });

    // Create venue
    await db.insert(venues).values({
      orgId: org.id,
      name: "Test Venue",
      timezone: "Australia/Sydney",
    });

    return NextResponse.json({
      ok: true,
      message: "Test user created successfully",
      email: testEmail,
      password: testPassword,
      userId: user.id,
      orgId: org.id,
    });
  } catch (error: any) {
    console.error("Error creating test user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create test user" },
      { status: 500 }
    );
  }
}
