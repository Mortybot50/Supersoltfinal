// app/layout.tsx
import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Sidebar } from "@/components/nav/Sidebar"
import { TopBar } from "@/components/top-bar"
import { AnalyticsProvider } from "@/lib/analytics"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "HospitalityOps Dashboard",
  description: "Modern hospitality operations management dashboard",
}

// Google: Space Grotesk (sans)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

// Local: Geist (used as “serif” slot per your design tokens)
const geist = localFont({
  src: "/fonts/GeistVF.woff2", // from public/fonts
  weight: "100 900",
  display: "swap",
  variable: "--font-serif",
})

// Local: Geist Mono (monospace)
const geistMono = localFont({
  src: "/fonts/GeistMonoVF.woff2", // from public/fonts
  weight: "100 900",
  display: "swap",
  variable: "--font-mono",
})

async function getBadges(): Promise<Record<string, number>> {
  const { cookies: getCookies } = await import("next/headers");
  const cookieStore = await getCookies();
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5000"}/api/automation/suggestions`, {
    cache: "no-store",
    headers: {
      Cookie: cookieStore.toString(),
    },
  }).catch(() => null);
  if (!res || !res.ok) return { suggestions: 0 };
  const data = await res.json();
  return { suggestions: data.items?.length ?? 0 };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const badges = await getBadges();
  const session = await auth();
  
  // Extract user data for analytics (no PII)
  const user = session?.user
    ? {
        id: session.user.id!,
        orgId: (session as any).orgId,
        role: (session as any).role,
      }
    : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${geist.variable} ${geistMono.variable} font-sans`}
      >
        <Providers>
          <AnalyticsProvider user={user}>
            <div className="flex min-h-screen">
              <Sidebar badges={badges} />
              <div className="flex flex-1 flex-col min-w-0">
                <TopBar />
                <main className="flex-1 overflow-auto p-6">{children}</main>
              </div>
            </div>
          </AnalyticsProvider>
        </Providers>
      </body>
    </html>
  )
}
