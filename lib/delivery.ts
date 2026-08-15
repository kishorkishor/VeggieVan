/**
 * VeggieVan delivery rules.
 *
 * Every value here is stated in the business plan (§1.A, §1.C, §6.B). Anything
 * the plan leaves open is marked ASSUMPTION and must be confirmed by the owner
 * before a real launch.
 */

export const DELIVERY_ZONES = [
  "Uttara",
  "Mirpur",
  "Bashundhara",
  "Khilgaon",
  "Dhanmondi",
] as const;

export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

export function isServiceableZone(value: string): value is DeliveryZone {
  return (DELIVERY_ZONES as readonly string[]).includes(value);
}

/** Orders are accepted 8:00 PM – 11:59 PM; sourcing runs against them overnight. */
export const ORDER_WINDOW = {
  openHour: 20,
  closeHour: 24,
  label: "8:00 PM and 11:59 PM",
  openLabel: "8:00 PM",
  closeLabel: "11:59 PM",
} as const;

/** Door-to-door delivery begins the following morning. */
export const DELIVERY_FROM = "7:00 AM";

/**
 * ASSUMPTION: the plan states when delivery *starts* but never when it ends,
 * and never names a per-customer window. Shown as an indicative window only.
 */
export const DELIVERY_WINDOW_LABEL = "7:00 AM – 10:00 AM";

/** Is the order window currently open, in Asia/Dhaka (UTC+6)? */
export function isOrderWindowOpen(now: Date = new Date()): boolean {
  const dhakaHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      hour12: false,
    }).format(now)
  );
  return dhakaHour >= ORDER_WINDOW.openHour;
}

export const PAYMENT_METHODS = [
  {
    id: "cod",
    label: "Cash on delivery",
    hint: "Pay the driver when your vegetables arrive.",
  },
  {
    id: "bkash",
    label: "bKash",
    hint: "Send payment to our merchant number and enter the transaction ID.",
  },
  {
    id: "nagad",
    label: "Nagad",
    hint: "Send payment to our merchant number and enter the transaction ID.",
  },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];
