import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import {
  findUserByEmail,
  roleForGoogleEmail,
  verifyPassword,
} from "@/lib/admin-users";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await findUserByEmail(email);
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Credentials sign-ins are validated in `authorize` above.
      if (account?.provider !== "google") return true;

      // For Google OAuth, only allowlisted emails get a role.
      const role = await roleForGoogleEmail(user.email);
      if (!role) return false;
      (user as { role?: "admin" | "staff" }).role = role;
      return true;
    },
  },
});
