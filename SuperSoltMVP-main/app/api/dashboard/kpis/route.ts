import { NextResponse } from "next/server"

export async function GET() {
  const kpis = {
    salesToDate: {
      value: 142500,
      change: 12.5,
    },
    averageChequeSize: {
      value: 45.80,
      change: 8.3,
    },
    dwellTime: {
      value: 42,
      change: -5.2,
    },
  }

  return NextResponse.json(kpis)
}
