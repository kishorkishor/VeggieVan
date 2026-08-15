import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-runtime middleware. Uses the slim `authConfig` (no bcrypt / DB) so it
// stays edge-compatible. The `authorized` callback in auth.config.ts decides
// who can access what.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, the Auth.js routes themselves,
  // and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
