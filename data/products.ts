// VeggieVan catalog.
//
// Source of truth for the demo. Every query in lib/products/queries.ts falls
// back to this file when Postgres is unreachable, so the storefront renders
// with no database at all.
//
// MONEY: integer paisa (1 BDT = 100 paisa), matching the integer-money
// convention the cart, checkout, and order code already use.
//
// PRICES AND QUANTITIES come directly from the business plan's "Individual
// Vegetable Pricing" table (§4.B). Both baskets' member prices sum to exactly
// the BDT 335 combined figure the plan prints, which is asserted in
// __tests__/data/baskets.test.ts so the site can never drift from the report.
//
// DELIVERY is a flat BDT 40 per order, charged separately (§4.B). There is no
// free-delivery threshold and no minimum order.
//
// SUBSCRIPTIONS were removed from the business plan and are not offered.
//
// CLAIMS: nothing here asserts organic status, certification, or a named farm.
// The plan makes no such claim, so neither does the catalog.

export type Category = "essentials" | "vegetables" | "baskets";

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number; // paisa
  unit: string; // the exact quantity sold, e.g. "1 kg", "500 g", "1 piece"
  category: Category;
  origin: string;
  organic: boolean;
  inSeason: boolean;
  featured?: boolean;
  stock: number;
  images: string[]; // resolved to local SVGs by lib/products/presentation.ts
  nutrition: { calories: number; carbs: number; protein: number; fiber: number };
  tags: string[];
};

export const CATEGORIES: { id: Category; label: string; blurb: string; emoji: string }[] = [
  { id: "essentials", label: "Everyday Essentials", blurb: "Potato, onion, tomato, garlic, chilli", emoji: "🧅" },
  { id: "vegetables", label: "Family Fresh", blurb: "Lau, begun, gajor, shosha, potol", emoji: "🥒" },
  { id: "baskets", label: "Baskets", blurb: "Two baskets, both cheaper than the parts", emoji: "🧺" },
];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const SOURCE = "Dhaka";

export const PRODUCTS: Product[] = [
  // ── Everyday Essentials ────────────────────────────────────────────────
  {
    id: "p01",
    slug: "potato",
    name: "Potato (Alu)",
    tagline: "The one thing every kitchen runs out of",
    description:
      "Firm, clean-skinned potatoes graded by size so they cook evenly. Sorted and weighed against your order the same night, never pulled from long storage.",
    price: 4500,
    unit: "1 kg",
    category: "essentials",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 260,
    images: [],
    nutrition: { calories: 77, carbs: 17, protein: 2, fiber: 2.2 },
    tags: ["alu", "staple", "curry", "bhaji", "everyday"],
  },
  {
    id: "p02",
    slug: "onion",
    name: "Local Onion (Peyaj)",
    tagline: "Local variety, sharp and aromatic",
    description:
      "Local onions with tight skins and no soft spots. Checked by hand for sprouting before they are bagged, because a bad onion ruins the whole tarkari.",
    price: 7000,
    unit: "1 kg",
    category: "essentials",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 180,
    images: [],
    nutrition: { calories: 40, carbs: 9.3, protein: 1.1, fiber: 1.7 },
    tags: ["peyaj", "onion", "staple", "beresta", "curry"],
  },
  {
    id: "p03",
    slug: "tomato",
    name: "Red Tomato",
    tagline: "Graded ripe, packed soft-side up",
    description:
      "Sorted into one ripeness grade so your bag does not mix rock-hard with over-soft. Packed in a shallow layer so nothing arrives crushed.",
    price: 4500,
    unit: "500 g",
    category: "essentials",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 140,
    images: [],
    nutrition: { calories: 18, carbs: 3.9, protein: 0.9, fiber: 1.2 },
    tags: ["tomato", "salad", "curry", "chutney"],
  },
  {
    id: "p04",
    slug: "garlic",
    name: "Imported Garlic (Roshun)",
    tagline: "Large, easy-peeling cloves",
    description:
      "Imported bulbs, chosen for large cloves that peel cleanly and firm, papery skins with no hollow centres. Sold by weight rather than by bulb, so you know exactly what you are paying for.",
    price: 12_500,
    unit: "500 g",
    category: "essentials",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 120,
    images: [],
    nutrition: { calories: 149, carbs: 33, protein: 6.4, fiber: 2.1 },
    tags: ["roshun", "garlic", "masala", "staple"],
  },
  {
    id: "p05",
    slug: "green-chilli",
    name: "Green Chilli (Kacha Morich)",
    tagline: "Picked firm, never limp",
    description:
      "Bright green chillies with the stems still on, which is how you tell they were picked recently. Sold in a 250 g pack so nothing sits in your fridge going soft.",
    price: 5000,
    unit: "250 g",
    category: "essentials",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 150,
    images: [],
    nutrition: { calories: 40, carbs: 9, protein: 1.9, fiber: 1.5 },
    tags: ["kacha morich", "chilli", "spicy", "everyday"],
  },

  // ── Family Fresh ───────────────────────────────────────────────────────
  {
    id: "p06",
    slug: "bottle-gourd",
    name: "Bottle Gourd (Lau)",
    tagline: "Young and tender, not woody",
    description:
      "Chosen young, when the skin still marks under a thumbnail and the seeds inside are soft. Sold whole by the piece, the way it is bought at the bazaar.",
    price: 5500,
    unit: "1 piece",
    category: "vegetables",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 70,
    images: [],
    nutrition: { calories: 14, carbs: 3.4, protein: 0.6, fiber: 0.5 },
    tags: ["lau", "gourd", "jhol", "light"],
  },
  {
    id: "p07",
    slug: "brinjal",
    name: "Brinjal (Begun)",
    tagline: "Glossy skin, light in the hand",
    description:
      "Graded for glossy, unwrinkled skin. A lighter brinjal means fewer seeds and less bitterness, so they are sorted by feel as well as by size.",
    price: 8500,
    unit: "800 g",
    category: "vegetables",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 110,
    images: [],
    nutrition: { calories: 25, carbs: 5.9, protein: 1, fiber: 3 },
    tags: ["begun", "brinjal", "eggplant", "bhaji", "bharta"],
  },
  {
    id: "p08",
    slug: "carrot",
    name: "Carrot (Gajor)",
    tagline: "Straight, firm, tops trimmed",
    description:
      "Trimmed and washed so they go straight into the fridge. Sorted to an even thickness, which matters more than length when you are slicing for a salad.",
    price: 7000,
    unit: "500 g",
    category: "vegetables",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 130,
    images: [],
    nutrition: { calories: 41, carbs: 9.6, protein: 0.9, fiber: 2.8 },
    tags: ["gajor", "carrot", "salad", "halua", "winter"],
  },
  {
    id: "p09",
    slug: "cucumber",
    name: "Cucumber (Shosha)",
    tagline: "Crisp, thin-skinned, no yellowing",
    description:
      "Selected thin-skinned and free of yellow patches, which are the first sign of an over-mature cucumber. Packed upright so they do not bruise on the van.",
    price: 5000,
    unit: "500 g",
    category: "vegetables",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 120,
    images: [],
    nutrition: { calories: 15, carbs: 3.6, protein: 0.7, fiber: 0.5 },
    tags: ["shosha", "cucumber", "salad", "raita", "summer"],
  },
  {
    id: "p10",
    slug: "pointed-gourd",
    name: "Pointed Gourd (Potol)",
    tagline: "Small and firm, the way it cooks best",
    description:
      "Graded small and firm rather than large, because oversized potol turn seedy. Stems trimmed short so they pack tightly without piercing the bag.",
    price: 7500,
    unit: "500 g",
    category: "vegetables",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    stock: 95,
    images: [],
    nutrition: { calories: 20, carbs: 4.2, protein: 2, fiber: 3 },
    tags: ["potol", "pointed gourd", "bhaji", "dorma", "curry"],
  },

  // ── Baskets ────────────────────────────────────────────────────────────
  // Both basket prices and their BDT 335 comparison totals are stated in §4.B.
  {
    id: "p11",
    slug: "basket-everyday-essentials",
    name: "Everyday Essentials Basket",
    tagline: "The five things you reach for daily",
    description:
      "1 kg potato, 1 kg local onion, 500 g red tomato, 500 g imported garlic, and 250 g green chilli — the base of almost every Bangladeshi meal, in one basket. Buying them separately comes to ৳335, so the basket saves you ৳36.",
    price: 29_900,
    unit: "5 vegetables",
    category: "baskets",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 40,
    images: [],
    nutrition: { calories: 65, carbs: 14.4, protein: 2.5, fiber: 1.7 },
    tags: ["basket", "essentials", "staple", "everyday", "value"],
  },
  {
    id: "p12",
    slug: "basket-family-fresh",
    name: "Family Fresh Basket",
    tagline: "A week of curries for a full household",
    description:
      "1 bottle gourd, 800 g brinjal, 500 g carrot, 500 g cucumber, and 500 g pointed gourd — enough variety to keep a family's dinners from repeating. Individually these come to ৳335, so the basket saves you ৳35.",
    price: 30_000,
    unit: "5 vegetables",
    category: "baskets",
    origin: SOURCE,
    organic: false,
    inSeason: true,
    featured: true,
    stock: 40,
    images: [],
    nutrition: { calories: 23, carbs: 5.3, protein: 1, fiber: 2 },
    tags: ["basket", "family", "curry", "variety", "value"],
  },
];

/**
 * Basket composition, kept beside the catalog so the storefront can show what
 * is inside a basket and the arithmetic behind its advertised saving.
 *
 * `comparisonTotal` is the figure printed in the business plan. It is asserted
 * against the sum of member prices in __tests__/data/baskets.test.ts, so the
 * savings shown on the site can never silently drift from the plan.
 */
export const BASKET_CONTENTS: Record<string, { items: string[]; comparisonTotal: number }> = {
  "basket-everyday-essentials": {
    items: ["potato", "onion", "tomato", "garlic", "green-chilli"],
    comparisonTotal: 33_500,
  },
  "basket-family-fresh": {
    items: ["bottle-gourd", "brinjal", "carrot", "cucumber", "pointed-gourd"],
    comparisonTotal: 33_500,
  },
};

/** Distinct selling quantities, largest first. */
export const UNITS: string[] = (() => {
  const order = ["1 kg", "800 g", "500 g", "250 g", "1 piece"];
  const present = Array.from(new Set(PRODUCTS.map((p) => p.unit)));
  return present.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.localeCompare(b);
  });
})();
