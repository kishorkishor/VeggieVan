import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@veggievan.local";
const ADMIN_PASSWORD = "admin123";

async function loginAsAdmin(page: Page) {
  // Wait for networkidle so the login page's Suspense boundary finishes
  // client-side rendering before the form is used.
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.locator('[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('[name="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("VeggieVan Admin").or(page.getByText("Dashboard"))).toBeVisible();
}

// Unlike the storefront, admin sign-in has no static fallback: `authorize()`
// looks the user up through Prisma. These tests therefore need a seeded
// database (`npm run db:push && npm run db:seed`) and are skipped without one.
test.describe("Admin happy path", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "Requires a seeded database — admin sign-in reads users through Prisma."
  );

  test("login to orders table to open drawer to close with Escape", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);

    await page.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/admin\/orders/);

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    await expect(rows).not.toHaveCount(0);

    await rows.first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    const closeBtn = drawer.getByRole("button", { name: "Close" });
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("admin can review the growth dashboard evidence", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);

    await page.getByRole("link", { name: "Growth" }).click();
    await expect(page).toHaveURL(/\/admin\/growth$/);
    await expect(page.getByRole("heading", { name: "Growth analytics" })).toBeVisible();
    await expect(page.getByText("Seeded demo data")).toBeVisible();

    for (const stage of [
      "Product viewed",
      "Added to cart",
      "Checkout started",
      "Checkout step completed",
      "Order completed",
    ]) {
      await expect(page.getByRole("heading", { name: stage })).toBeVisible();
    }

    for (const experiment of [
      "Checkout reassurance",
      "Free shipping progress",
      "Related product ranking",
    ]) {
      await expect(page.getByRole("heading", { name: experiment })).toBeVisible();
    }

    await expect(
      page
        .getByText(/^(Insufficient evidence \u2014 directional only|Descriptive comparison only)$/)
        .first(),
    ).toBeVisible();
  });
});
