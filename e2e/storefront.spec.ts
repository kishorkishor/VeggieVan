import { test, expect, type Page } from "@playwright/test";
import { assignVariant, type ExperimentKey, type Variant } from "../lib/growth/experiments";

type CapturedGrowthRequest = {
  path: string;
  body: Record<string, unknown>;
};

const ALL_EXPERIMENTS: ExperimentKey[] = [
  "checkout_reassurance_v1",
  "related_product_ranking_v1",
];

function sessionFor(variant: Variant) {
  for (let index = 1; index <= 10_000; index += 1) {
    const sessionId = `sess_00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    if (ALL_EXPERIMENTS.every((key) => assignVariant(sessionId, key) === variant)) return sessionId;
  }
  throw new Error(`No deterministic ${variant} session found`);
}

async function installGrowthHarness(
  page: Page,
  variant: Variant,
  cartItems: { productId: string; qty: number }[] = [],
) {
  const captured: CapturedGrowthRequest[] = [];
  await page.route("**/api/growth/**", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    captured.push({ path: new URL(request.url()).pathname, body });
    await route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(({ sessionId, items }) => {
    sessionStorage.setItem("veggievan-growth-identity-v1", JSON.stringify({
      sessionId,
      attribution: { landingPath: "/products/:slug", referrerCategory: "direct" },
    }));
    sessionStorage.removeItem("veggievan-growth-assignments-v1");
    if (items.length > 0) {
      localStorage.setItem("veggievan-cart", JSON.stringify({ state: { items }, version: 0 }));
    }
  }, { sessionId: sessionFor(variant), items: cartItems });
  return captured;
}

function events(captured: CapturedGrowthRequest[], name: string) {
  return captured.filter(({ path, body }) => path === "/api/growth/events" && body.name === name);
}

function exposures(captured: CapturedGrowthRequest[], experiment: ExperimentKey) {
  return captured.filter(({ path, body }) => (
    path === "/api/growth/exposures" && body.experiment === experiment
  ));
}

// Storefront happy path. Requires no database and no login — the catalog
// falls back to the static seed when DATABASE_URL is absent.
test.describe("Storefront happy path", () => {
  test("browse → PDP → add to basket → drawer → checkout page", async ({ page }) => {
    test.setTimeout(60_000);

    // 1. Product list renders cards.
    await page.goto("/products", { waitUntil: "networkidle" });
    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();

    // 2. Open the first product's detail page. Navigate via href instead of
    //    clicking: the card's framer-motion hover animation keeps the element
    //    unstable long enough to flake pointer-based clicks.
    const href = await firstCard.getByRole("link").first().getAttribute("href");
    expect(href).toMatch(/\/products\/.+/);
    await page.goto(href!, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/products\/.+/);

    // 3. Add to basket — the cart drawer auto-opens.
    await page.getByRole("button", { name: /add to basket/i }).first().click();
    const drawer = page.locator("aside", {
      has: page.getByRole("heading", { name: "Your basket" }),
    });
    await expect(drawer.getByRole("heading", { name: "Your basket" })).toBeVisible();

    // 4. Increment quantity inside the drawer; the subtotal changes.
    const subtotal = drawer.locator("dd").first();
    const before = await subtotal.textContent();
    await drawer.getByRole("button", { name: "Increase" }).click();
    await expect(subtotal).not.toHaveText(before ?? "");

    // 5. Proceed to checkout; the address step renders.
    await drawer.getByRole("link", { name: /checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();
  });

  test("control preserves current surfaces and captures product placements", async ({ page }) => {
    const captured = await installGrowthHarness(page, "control");
    await page.goto("/products/tomato", { waitUntil: "networkidle" });

    const related = page.getByRole("heading", { name: "You may also like" }).locator("..");
    await expect(related.locator("article h3")).toHaveText([
      "Green Chilli (Kacha Morich)",
      "Imported Garlic (Roshun)",
      "Local Onion (Peyaj)",
      "Potato (Alu)",
    ]);
    await expect.poll(() => exposures(captured, "related_product_ranking_v1").length).toBe(1);
    await expect.poll(() => events(captured, "product_viewed").length).toBe(1);
    expect(events(captured, "product_viewed")[0].body.properties).toMatchObject({
      productId: "p03",
      placement: "direct",
    });

    await page.getByRole("button", { name: /add to basket/i }).first().click();
    const drawer = page.locator("aside", { has: page.getByRole("heading", { name: "Your basket" }) });
    await expect(drawer.getByRole("link", { name: "Checkout", exact: true })).toBeVisible();
    // No free-delivery progress bar exists any more: delivery is a flat ৳40.
    await expect(drawer.getByRole("progressbar")).toHaveCount(0);
    await expect(drawer.getByText("৳40 delivery per order", { exact: false })).toBeVisible();
    await expect.poll(() => events(captured, "add_to_cart").length).toBe(1);
    expect(events(captured, "add_to_cart")[0].body.properties).toMatchObject({
      productId: "p03",
      quantity: 1,
      cartValue: 4_500,
      cartSize: 1,
      placement: "pdp",
    });

    await drawer.getByRole("button", { name: "Close" }).click();
    await related.locator("article").first().getByRole("button", { name: /add to basket/i }).click();
    await expect.poll(() => events(captured, "add_to_cart").length).toBe(2);
    expect(events(captured, "add_to_cart")[1].body.properties).toMatchObject({
      productId: "p05",
      cartValue: 9_500,
      cartSize: 2,
      placement: "recommendation",
    });
    await drawer.getByRole("link", { name: "Checkout", exact: true }).click();
    await expect(page.getByText("Fresh, secure, straightforward")).toHaveCount(0);
    await expect.poll(() => exposures(captured, "checkout_reassurance_v1").length).toBe(1);

    await page.goto("/products", { waitUntil: "networkidle" });
    await page.locator("article").first().getByRole("button", { name: /add to basket/i }).click();
    await expect.poll(() => events(captured, "add_to_cart").length).toBe(3);
    expect(events(captured, "add_to_cart")[2].body.properties).toMatchObject({
      productId: "p06",
      cartValue: 15_000,
      cartSize: 3,
      placement: "listing",
    });
  });

  test("treatment reorders recommendations without changing the cart surface", async ({ page }) => {
    const captured = await installGrowthHarness(page, "treatment");
    await page.goto("/products/tomato", { waitUntil: "networkidle" });

    const related = page.getByRole("heading", { name: "You may also like" }).locator("..");
    await expect(related.locator("article h3")).toHaveText([
      "Potato (Alu)",
      "Local Onion (Peyaj)",
      "Imported Garlic (Roshun)",
      "Green Chilli (Kacha Morich)",
    ]);
    await expect.poll(() => exposures(captured, "related_product_ranking_v1").length).toBe(1);

    await page.getByRole("button", { name: /add to basket/i }).first().click();
    const drawer = page.locator("aside", { has: page.getByRole("heading", { name: "Your basket" }) });
    await expect(drawer.getByRole("link", { name: "Checkout", exact: true })).toBeVisible();
    await expect(drawer.getByRole("progressbar")).toHaveCount(0);
  });

  test("checkout exposes reassurance only and tracks validated steps at completion", async ({ page }) => {
    const captured = await installGrowthHarness(page, "treatment", [{ productId: "p01", qty: 1 }]);
    await page.goto("/checkout", { waitUntil: "networkidle" });

    await expect(page.getByText("Fresh, secure, straightforward")).toBeVisible();
    await expect.poll(() => exposures(captured, "checkout_reassurance_v1").length).toBe(1);
    await expect.poll(() => events(captured, "checkout_started").length).toBe(1);

    await page.getByRole("button", { name: /continue/i }).click();
    expect(events(captured, "checkout_step_completed")).toHaveLength(0);

    await page.getByLabel("Full name").fill("Rehana Akter");
    await page.getByLabel("Mobile number").fill("01712345678");
    await page.getByLabel("Delivery area").selectOption("Dhanmondi");
    await page.getByLabel("House, road, block / apartment").fill("House 24, Road 7");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect.poll(() => events(captured, "checkout_step_completed").length).toBe(1);
    expect(events(captured, "checkout_step_completed")[0].body.properties).toMatchObject({
      step: 1,
      stepName: "address",
      cartValue: 4_500,
    });

    await page.getByRole("button", { name: /continue/i }).click();
    await expect.poll(() => events(captured, "checkout_step_completed").length).toBe(2);
    expect(events(captured, "checkout_step_completed")[1].body.properties).toMatchObject({
      step: 2,
      stepName: "delivery",
      cartValue: 4_500,
    });

    page.on("dialog", (dialog) => void dialog.dismiss());
    const paymentStartedAt = Date.now();
    await page.getByRole("button", { name: /place order/i }).click();
    await expect.poll(() => events(captured, "checkout_step_completed").length).toBe(3);
    const paymentEvent = events(captured, "checkout_step_completed")[2].body;
    expect(paymentEvent.properties).toMatchObject({
      step: 3,
      stepName: "payment",
      cartValue: 4_500,
    });
    expect(typeof paymentEvent.occurredAt).toBe("string");
    expect(Date.parse(paymentEvent.occurredAt as string) - paymentStartedAt).toBeGreaterThanOrEqual(750);
    expect(events(captured, "checkout_started")).toHaveLength(1);
  });
});
