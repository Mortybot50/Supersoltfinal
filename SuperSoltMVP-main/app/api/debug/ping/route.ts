import { NextResponse } from "next/server"
import { db } from "@/db"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT now() as ts`)
    const ts = result.rows[0]?.ts

    return NextResponse.json({ ok: true, ts })
  } catch (err: any) {
    console.error("DB ping error", err)
    return NextResponse.json(
      { ok: false, message: err.message },
      { status: 500 }
    )
  }
}
