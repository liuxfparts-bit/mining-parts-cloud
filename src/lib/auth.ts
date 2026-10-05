// ============================================================
// Auth.js v5 配置
// ============================================================
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

const secret = process.env.AUTH_SECRET || "dev-only-secret";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password as string;
        if (!email || !password) return null;

        // insensitive 兜底：兼容历史大小写混存的邮箱，避免“重置成功但登录失败”
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          orderBy: { id: "asc" },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new InvalidLogin();

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = (user as any).id;
        token.sessionVersion = (user as any).sessionVersion;
        token.invalidated = false;
        return token;
      }

      const uid = Number(token.uid);
      if (!uid) return token;
      const current = await prisma.user.findUnique({
        where: { id: uid },
        select: { role: true, status: true, sessionVersion: true },
      });
      if (!current || current.status !== "ACTIVE" || current.sessionVersion !== Number(token.sessionVersion)) {
        token.invalidated = true;
        return token;
      }
      token.role = current.role;
      token.invalidated = false;
      return token;
    },
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
