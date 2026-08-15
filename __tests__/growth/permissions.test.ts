import { describe, expect, it } from "vitest";

import {
  adminPathDecision,
  authorizeAdminRequest,
  isAdminOnlyPath,
} from "@/auth.config";
import { getAdminNavItems } from "@/components/admin/adminNavigation";

describe("growth dashboard permissions", () => {
  it("treats the growth route and descendants as admin-only", () => {
    expect(isAdminOnlyPath("/admin/growth")).toBe(true);
    expect(isAdminOnlyPath("/admin/growth/details")).toBe(true);
  });

  it("redirects staff away while permitting admins", () => {
    expect(adminPathDecision("/admin/growth", "staff")).toBe("deny");
    expect(adminPathDecision("/admin/growth", "admin")).toBe("allow");
  });

  it("lets Auth.js send anonymous admin requests to sign-in", () => {
    expect(adminPathDecision("/admin/growth", undefined)).toBe("sign-in");
  });

  it("maps growth roles to the real Auth.js callback results", () => {
    const nextUrl = new URL("http://localhost/admin/growth");

    const staffResult = authorizeAdminRequest({
      auth: { user: { role: "staff" } },
      request: { nextUrl },
    });
    expect(staffResult).toBeInstanceOf(Response);
    expect((staffResult as Response).headers.get("Location"))
      .toBe("http://localhost/admin?denied=1");

    expect(authorizeAdminRequest({
      auth: null,
      request: { nextUrl },
    })).toBe(false);

    expect(authorizeAdminRequest({
      auth: { user: { role: "admin" } },
      request: { nextUrl },
    })).toBe(true);
  });

  it("shows Growth to admins but not staff from the shared navigation registry", () => {
    expect(getAdminNavItems("admin").map((item) => item.label)).toContain("Growth");
    expect(getAdminNavItems("staff").map((item) => item.label)).not.toContain("Growth");
  });
});
