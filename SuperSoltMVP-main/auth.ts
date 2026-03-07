import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { cookies } from "next/headers"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = String(credentials.email).toLowerCase()
        const password = String(credentials.password)

        // Lazy import to avoid bundling in middleware
        const { db } = await import("@/db")
        const { users, memberships } = await import("@/db/schema")
        const { eq } = await import("drizzle-orm")
        const bcrypt = await import("bcrypt")

        // Find user in database
        const user = await db.query.users.findFirst({
          where: (t, { eq }) => eq(t.email, email)
        })

        if (!user || !user.password_hash) {
          return null
        }

        // Verify password
        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) {
          return null
        }

        // Pick first membership as default org
        const m = await db.query.memberships.findFirst({
          where: (t, { eq }) => eq(t.userId, user.id)
        })

        if (!m) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: m.orgId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, include user.id and orgId in the token
      if (user) {
        token.id = user.id
        token.orgId = (user as any).orgId
      }

      return token
    },
    async session({ session, token }) {
      // Include user.id and orgId in the session
      if (token) {
        session.user.id = token.id as string
        if (token.orgId) {
          session.user.orgId = token.orgId as string
        }
      }
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isAuthenticated = !!auth
      const isApiRoute = pathname.startsWith("/api")

      // Public routes that don't require authentication
      const isPublicRoute =
        pathname === "/" ||
        pathname.startsWith("/auth/") ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/invite/") ||
        pathname.startsWith("/api/people/invites/validate") ||
        pathname.startsWith("/api/people/invites/accept")

      // If not authenticated and trying to access protected route
      if (!isAuthenticated && !isPublicRoute) {
        // For API routes, return 401 JSON response
        if (isApiRoute) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 }
          )
        }
        // For page routes, redirect to sign-in (return false)
        return false
      }

      // If authenticated and trying to access sign-in/login page, redirect to dashboard
      if (isAuthenticated && (pathname === "/auth/signin" || pathname === "/auth/login")) {
        return Response.redirect(new URL("/dashboard", request.url))
      }

      return true
    },
  },
  pages: {
    signIn: "/auth/login",
  },
})
