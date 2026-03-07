import { NextResponse } from "next/server"

export async function GET() {
  const salesForecast = [
    {
      day: "Mon",
      sales: 12500,
      forecast: 11000,
    },
    {
      day: "Tue",
      sales: 15200,
      forecast: 13500,
    },
    {
      day: "Wed",
      sales: 18900,
      forecast: 17000,
    },
    {
      day: "Thu",
      sales: 22100,
      forecast: 19500,
    },
    {
      day: "Fri",
      sales: 28400,
      forecast: 26000,
    },
    {
      day: "Sat",
      sales: 31200,
      forecast: 29000,
    },
    {
      day: "Sun",
      sales: 14200,
      forecast: 15000,
    },
  ]

  return NextResponse.json(salesForecast)
}
