// Auth.js (NextAuth v5). Login por e-mail+senha.
// Sessão JWT -> não precisa de adapter/tabelas de sessão no MVP.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isLocked, registerFailure, clearFailures } from "@/lib/rateLimit";

/** Normaliza e-mail para lookup/rate-limit. */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = normalizeEmail(creds?.email);
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        // Anti força-bruta: bloqueia o e-mail após tentativas erradas demais.
        const rlKey = `login:${email}`;
        if (await isLocked(rlKey)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await registerFailure(rlKey);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await registerFailure(rlKey);
          return null;
        }

        // Conta suspensa não entra (mesmo com senha certa).
        if (user.status === "SUSPENDED") return null;

        await clearFailures(rlKey);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? "MEMBER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
