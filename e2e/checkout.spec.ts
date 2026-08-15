import { test, expect } from "@playwright/test";

// The complete VeggieVan buying journey, end to end, with no database and no
// login: the catalog falls back to the static seed and the order action
// completes as a server-priced demo order.
test.describe("VeggieVan checkout journey", () => {
  test("basket → address → delivery → payment → confirmation", async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Land on a basket product page and add it.
    await page.goto("/products/basket-everyday-essentials", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Everyday Essentials Basket" })
    ).toBeVisible();
    await page.getByRole("button", { name: /add to basket/i }).first().click();

    // 2. Go to checkout. Subtotal ৳299 + ৳40 delivery = ৳339.
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();
    await expect(page.getByText("৳339")).toBeVisible();

    // 3. Address step — Bangladeshi fields only.
    await page.getByLabel("Full name").fill("Rehana Akter");
    await page.getByLabel("Mobile number").fill("01712345678");
    await page.getByLabel("Delivery area").selectOption("Dhanmondi");
    await page.getByLabel("House, road, block / apartment").fill("House 24, Road 7, Flat 4B");
    await page.getByRole("button", { name: /continue/i }).click();

    // 4. Delivery step — one fixed next-morning run, no slot picker.
    await expect(page.getByRole("heading", { name: "Tomorrow morning" })).toBeVisible();
    await expect(page.getByText("Delivery starts 7:00 AM")).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // 5. Payment step — COD, bKash, Nagad.
    await expect(
      page.getByRole("heading", { name: "How would you like to pay?" })
    ).toBeVisible();
    await expect(page.getByText("Cash on delivery", { exact: true })).toBeVisible();
    await expect(page.getByText("bKash", { exact: true })).toBeVisible();
    await expect(page.getByText("Nagad", { exact: true })).toBeVisible();

    // Choosing bKash reveals the transaction-ID field; COD does not need one.
    await page.getByRole("radio", { name: /bKash/i }).check();
    await expect(page.getByLabel("bKash transaction ID")).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm payment/i })).toBeVisible();

    await page.getByRole("radio", { name: /cash on delivery/i }).check();
    await expect(page.getByLabel("bKash transaction ID")).toBeHidden();

    // 6. Place the order and land on the confirmation.
    await page.getByRole("button", { name: /place order/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
    await expect(page.getByText(/arriving tomorrow morning/i)).toBeVisible();
  });

  // Regression: React reused a single DOM button for "Continue" and the submit
  // button, flipping only its `type`. Because step 3 is entered from that
  // button's own click handler, the browser then ran the default action of a
  // now-submit button and placed the order before the payment step was ever
  // shown. Leaving the delivery step must never place an order.
  test("leaving the delivery step does not place the order", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "veggievan-cart",
        JSON.stringify({ state: { items: [{ productId: "p11", qty: 1 }] }, version: 0 })
      );
    });
    await page.goto("/checkout", { waitUntil: "networkidle" });

    await page.getByLabel("Full name").fill("Rehana Akter");
    await page.getByLabel("Mobile number").fill("01712345678");
    await page.getByLabel("House, road, block / apartment").fill("House 24");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: "Tomorrow morning" })).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // We are on the payment step, idle — not mid-submission, and still here.
    await expect(page.getByRole("heading", { name: "How would you like to pay?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /placing order/i })).toBeHidden();
    await expect(page).not.toHaveURL(/\/checkout\/success/);
  });

  test("rejects a non-Bangladeshi mobile number before advancing", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "veggievan-cart",
        JSON.stringify({ state: { items: [{ productId: "p11", qty: 1 }] }, version: 0 })
      );
    });
    await page.goto("/checkout", { waitUntil: "networkidle" });

    await page.getByLabel("Full name").fill("Rehana Akter");
    await page.getByLabel("Mobile number").fill("+44 7700 900123");
    await page.getByLabel("House, road, block / apartment").fill("House 24");
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/enter a valid mobile number/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();
  });
});
