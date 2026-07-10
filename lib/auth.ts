import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Rate limit simple contra fuerza bruta: 5 intentos fallidos por email
// bloquean 15 minutos. In-memory basta: corre en una sola instancia.
const failedLogins = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function isLocked(email: string): boolean {
  const e = failedLogins.get(email);
  if (!e) return false;
  if (Date.now() > e.until) { failedLogins.delete(email); return false; }
  return e.count >= MAX_ATTEMPTS;
}

function registerFailure(email: string) {
  const e = failedLogins.get(email);
  if (e && Date.now() <= e.until) { e.count += 1; }
  else { failedLogins.set(email, { count: 1, until: Date.now() + LOCK_MS }); }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        if (isLocked(email)) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) { registerFailure(email); return null; }

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) { registerFailure(email); return null; }

        failedLogins.delete(email);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
});
