import NextAuth from "next-auth";

const secret = process.env.AUTH_SECRET || "dev-only-secret";

// Edge-safe Auth.js instance for Next.js Middleware only.
// IMPORTANT: this file must never import Prisma or execute database queries.
// Database-backed status/role/sessionVersion validation remains in src/lib/auth.ts
// and is enforced again in server layouts/routes close to protected data.
export const { auth: edgeAuth } = NextAuth({
  secret,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token.invalidated) return { ...session, user: undefined } as any;
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.uid;
      }
      return session;
    },
  },
});
