import type { ProductRow } from "@/lib/products/queries";

const CATALOG_IMAGE_BASE = "/product-images/veggievan-catalog";

export const HOME_HERO_IMAGE = {
  src: "/home-images/veggievan-truck.webp",
  alt: "A green vegetable delivery truck parked on a quiet street, its side open on crates of fresh produce",
};

export const HERO_PRODUCT_IMAGES = [
  { src: `${CATALOG_IMAGE_BASE}/tomato.webp`, alt: "Fresh tomatoes on a white background" },
  { src: `${CATALOG_IMAGE_BASE}/bottle-gourd.webp`, alt: "A bottle gourd (lau) on a white background" },
  { src: `${CATALOG_IMAGE_BASE}/green-chilli.webp`, alt: "Fresh green chillies on a white background" },
];

// One photograph per product. There is no second angle to show, so the PDP
// renders no thumbnail strip rather than repeating the same shot twice.
export function productImagesFor(slug: string) {
  return [`${CATALOG_IMAGE_BASE}/${slug}.webp`];
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
