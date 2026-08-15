import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const ADMIN_ONLY_PATHS = ["/admin/growth", "/admin/inventory", "/admin/users"];

export function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

export function adminPathDecision(
  pathname: string,
  role: "admin" | "staff" | undefined
) {
  const isProtectedAdminPath =
    pathname.startsWith("/admin") && pathname !== "/admin/login";
  if (!isProtectedAdminPath) return "allow";
  if (!role) return "sign-in";
  if (isAdminOnlyPath(pathname) && role !== "admin") return "deny";
  return "allow";
}

export function authorizeAdminRequest({
  auth,
  request: { nextUrl },
}: {
  auth: { user?: { role?: "admin" | "staff" } } | null;
  request: { nextUrl: URL };
}) {
  const { pathname } = nextUrl;

  if (auth && pathname === "/admin/login") {
    return Response.redirect(new URL("/admin", nextUrl));
  }

  const decision = adminPathDecision(pathname, auth?.user?.role);
  if (decision === "sign-in") return false;
  if (decision === "deny") {
    return Response.redirect(new URL("/admin?denied=1", nextUrl));
  }
  return true;
}

// Edge-safe Auth.js config used by middleware. Anything that needs Node
// APIs (bcryptjs, DB drivers) must NOT live here — keep that in `auth.ts`.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/admin/login",
  },
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    authorized: authorizeAdminRequest,
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: "admin" | "staff" }).role;
        token.id = (user as { id?: string }).id ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "staff" | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
