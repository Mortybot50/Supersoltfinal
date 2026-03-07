"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"
import { AutoSetActiveVenue } from "@/app/components/AutoSetActiveVenue"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AutoSetActiveVenue />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
