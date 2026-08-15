import type { ProductRow } from "@/lib/products/queries";

const CATALOG_IMAGE_BASE = "/product-images/veggievan-catalog";

export const HOME_HERO_IMAGE = {
  src: "/home-images/veggievan-hero.svg",
  alt: "A green VeggieVan delivery van loaded with crates of vegetables at first light",
};

export const HERO_PRODUCT_IMAGES = [
  { src: `${CATALOG_IMAGE_BASE}/tomato.svg`, alt: "Tomatoes on a warm neutral background" },
  { src: `${CATALOG_IMAGE_BASE}/bottle-gourd.svg`, alt: "Bottle gourd (lau) on a warm neutral background" },
  { src: `${CATALOG_IMAGE_BASE}/palong-shak.svg`, alt: "A bunch of palong shak on a warm neutral background" },
];

export function productImagesFor(slug: string) {
  return [`${CATALOG_IMAGE_BASE}/${slug}.svg`, `${CATALOG_IMAGE_BASE}/${slug}-detail.svg`];
}

export function presentProduct<T extends ProductRow>(product: T): T {
  return { ...product, images: productImagesFor(product.slug) };
}

export function presentProducts<T extends ProductRow>(products: T[]): T[] {
  return products.map(presentProduct);
}

// The homepage shows the same catalog illustrations as everywhere else, so
// there is no separate photographic treatment to swap in. Kept as an explicit
// seam: if real product photography arrives later, override it here alone.
export function presentHomepageProduct<T extends ProductRow>(product: T): T {
  return product;
}

export function presentHomepageProducts<T extends ProductRow>(products: T[]): T[] {
  return products.map(presentHomepageProduct);
}
