import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Moon, Sunrise, MapPin, ShoppingBasket, Truck, PackageCheck } from "lucide-react";
import { BASKET_CONTENTS } from "@/data/products";
import { listProducts, type ProductRow } from "@/lib/products/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { HOME_HERO_IMAGE, presentHomepageProducts } from "@/lib/products/presentation";
import { DELIVERY_ZONES, DELIVERY_FROM } from "@/lib/delivery";
import { DELIVERY_CHARGE } from "@/lib/cart-math";

export const revalidate = 60;

/** "Potato (Alu)" → "Potato". Basket contents read cleaner without the gloss. */
function plainName(name: string) {
  return name.replace(/\s*\([^)]*\)/, "");
}

export default async function Home() {
  let products: ProductRow[] = [];
  try {
    products = await listProducts();
  } catch (e) {
    console.error("listProducts failed on /:", e);
  }

  const vegetables = products.filter((p) => p.category !== "baskets").slice(0, 8);
  const baskets = products.filter((p) => p.category === "baskets");

  return (
    <div>
      {/* HERO */}
      <section className="overflow-hidden border-b border-vv-line bg-vv-cream">
        <div className="grid h-1 grid-cols-3">
          <div className="bg-vv-leaf" />
          <div className="bg-vv-yellow" />
          <div className="bg-vv-orange" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:min-h-[560px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14 lg:py-16">
          <div className="animate-fade-up">
            <h1 className="max-w-lg font-display text-2xl font-semibold leading-[1.05] tracking-tight text-vv-ink sm:text-3xl lg:text-4xl">
              Bringing fresh vegetables home every morning.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-vv-ink/75 sm:text-lg sm:leading-8">
              Fresh vegetables sourced to order and delivered to your doorstep the next morning.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary px-7 py-3">
                Shop vegetables <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/products?category=baskets" className="btn-outline px-7 py-3">
                View baskets
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-vv-line pt-5">
              <Fact icon={<Moon />} label="Freshly sourced overnight" />
              <Fact icon={<Sunrise />} label={`Delivery starts at ${DELIVERY_FROM}`} />
              <Fact icon={<MapPin />} label={`${DELIVERY_ZONES.length} areas in Dhaka`} />
            </div>
          </div>

          <div className="relative min-h-[280px] overflow-hidden rounded-[2rem] border border-vv-line bg-white shadow-lift sm:min-h-[420px] lg:min-h-[520px]">
            <Image
              src={HOME_HERO_IMAGE.src}
              alt={HOME_HERO_IMAGE.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="scroll-mt-24 border-b border-vv-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <SectionHead label="How it works" title="From order to delivery" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <ShoppingBasket />,
                when: "Evening",
                title: "Place your order",
                body: "Choose individual vegetables or one of our prepared baskets before ordering closes for the night.",
              },
              {
                icon: <Truck />,
                when: "Overnight",
                title: "We source",
                body: "We source vegetables for confirmed orders from trusted farmers and Karwan Bazar wholesalers.",
              },
              {
                icon: <PackageCheck />,
                when: "Before delivery",
                title: "We check and pack",
                body: "Each order is inspected, sorted, weighed and packed carefully for morning delivery.",
              },
              {
                icon: <Sunrise />,
                when: `From ${DELIVERY_FROM}`,
                title: "We deliver",
                body: `Our five vans begin doorstep delivery across the selected areas in Dhaka.`,
              },
            ].map((s, i) => (
              <div key={s.title} className="card flex h-full flex-col gap-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vv-leaf/10 text-vv-leafDark [&>*]:h-5 [&>*]:w-5">
                    {s.icon}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-vv-mute">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-vv-leafDark">
                    {s.when}
                  </div>
                  <div className="mt-1.5 font-display text-lg font-semibold">{s.title}</div>
                  <p className="mt-2 text-sm leading-6 text-vv-ink/70">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BASKET OPTIONS */}
      <section id="baskets" className="scroll-mt-24 border-b border-vv-line">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              label="Basket options"
              title="Choose your basket"
              sub="Two fixed selections for everyday vegetable needs."
            />
            <Link href="/products" className="text-sm text-vv-leafDark hover:underline">
              Browse individual vegetables →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {baskets.map((b) => {
              const contents = BASKET_CONTENTS[b.slug];
              const saving = contents ? (contents.comparisonTotal - b.price) / 100 : 0;
              const items = (contents?.items ?? [])
                .map((slug) => products.find((p) => p.slug === slug))
                .filter((p): p is ProductRow => Boolean(p));

              return (
                <article key={b.id} className="card flex h-full flex-col overflow-hidden sm:flex-row">
                  <div className="relative aspect-square w-full shrink-0 bg-white sm:aspect-auto sm:w-48">
                    <Image
                      src={b.images[0]}
                      alt={b.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 192px"
                      className="object-contain"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold leading-tight">{b.name}</h3>
                      <span className="shrink-0 font-semibold tabular-nums">BDT {b.price / 100}</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-vv-ink/75">
                      {items.map((p) => (
                        <li key={p.id}>
                          {plainName(p.name)} · {p.unit}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-vv-leafDark">
                      Save BDT {saving} compared with individual prices
                    </p>
                    <Link
                      href={`/products/${b.slug}`}
                      className="btn-outline mt-4 w-full sm:mt-auto sm:w-fit"
                    >
                      View basket
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* INDIVIDUAL VEGETABLES */}
      <section className="border-b border-vv-line">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead label="Individual vegetables" title="Buy exactly what you need" />
            <Link href="/products" className="text-sm text-vv-leafDark hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {presentHomepageProducts(vegetables).map((p, i) => (
              <ProductCard key={p.id} p={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* WHY VEGGIEVAN */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
        <div className="overflow-hidden rounded-3xl bg-vv-ink p-8 text-white sm:p-12 lg:p-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-vv-leaf">
                Why VeggieVan
              </span>
              <h2 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">
                A simpler way to buy fresh vegetables.
              </h2>
              <p className="mt-4 max-w-lg text-white/70">
                We source mainly against confirmed orders, then inspect, sort, weigh and pack each
                order before morning delivery.
              </p>
              <Link href="/products" className="btn-primary mt-7 inline-flex">
                Shop vegetables
              </Link>
            </div>
            <div className="grid gap-4 self-start sm:grid-cols-3">
              {[
                { v: String(DELIVERY_ZONES.length), k: "Dhaka delivery areas" },
                { v: `From ${DELIVERY_FROM}`, k: "Delivery begins" },
                { v: `BDT ${DELIVERY_CHARGE / 100}`, k: "Delivery fee per order" },
              ].map((s) => (
                <div key={s.k} className="flex h-full flex-col rounded-2xl bg-white/5 p-5">
                  <div className="font-display text-xl font-semibold leading-tight text-vv-yellow">
                    {s.v}
                  </div>
                  <div className="mt-2 text-sm text-white/60">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DELIVERY AREAS */}
      <section id="delivery-areas" className="scroll-mt-24 border-t border-vv-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-16">
          <SectionHead label="Delivery areas" title="Where we deliver" />
          <p className="mt-6 font-display text-xl text-vv-ink sm:text-2xl">
            {DELIVERY_ZONES.join(" · ")}
          </p>
          <p className="mt-3 text-sm text-vv-mute">
            Selected surrounding neighbourhoods are also covered.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-vv-line bg-vv-cream">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:py-16">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Vegetables for tomorrow morning?
            </h2>
            <p className="mt-2 text-vv-ink/70">
              Choose what you need and place your order tonight.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary px-7 py-3">
              Start shopping <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/products?category=baskets" className="btn-outline px-7 py-3">
              View baskets
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-vv-leafDark">
        {label}
      </span>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-md text-sm text-vv-ink/70">{sub}</p>}
    </div>
  );
}

function Fact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-vv-ink/75">
      <span className="text-vv-leafDark [&>*]:h-4 [&>*]:w-4">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}
