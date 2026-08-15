import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format integer paisa as Bangladeshi Taka.
 *
 * Vegetables are priced in whole taka, so the decimals are dropped unless a
 * value actually carries paisa. Uses the ৳ sign rather than the "BDT 1,234.00"
 * that Intl produces for en-BD, because ৳ is what shoppers in Dhaka read.
 */
export function formatBDT(paisa: number) {
  const taka = paisa / 100;
  const hasPaisa = paisa % 100 !== 0;
  return `৳${new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: hasPaisa ? 2 : 0,
  }).format(taka)}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
