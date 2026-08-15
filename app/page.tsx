import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Sunrise, MapPin, ShoppingBasket, Truck, PackageCheck } from "lucide-react";
import { CATEGORIES } from "@/data/products";
import { listFeaturedProducts, type ProductRow } from "@/lib/products/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { HOME_HERO_IMAGE, presentHomepageProducts } from "@/lib/products/presentation";
import { DELIVERY_ZONES, ORDER_WINDOW, DELIVERY_FROM } from "@/lib/delivery";

export const revalidate = 60;

export default async function Home() {
  let featured: ProductRow[] = [];
  try {
    featured = await listFeaturedProducts(8);
  } catch (e) {
    console.error("listFeaturedProducts failed on /:", e);
  }
  return (
    <div>
      {/* HERO */}
      <section className="overflow-hidden border-b border-vv-line bg-vv-cream">
        <div className="grid h-1 grid-cols-3">
          <div className="bg-vv-leaf" />
          <div className="bg-vv-yellow" />
          <div className="bg-vv-orange" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:min-h-[620px] lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-12 lg:py-14">
          <div className="animate-fade-up">
            <div className="font-display text-[clamp(2.6rem,7.4vw,5.4rem)] font-semibold leading-[0.9] tracking-tight text-vv-ink">
              <span>Veggie</span>
              <span className="italic text-vv-leaf">Van</span>
              <span className="text-vv-red">.</span>
            </div>

            <div className="mt-5 max-w-xl border-t border-vv-line pt-5 sm:mt-6 sm:pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-vv-mute">
                Pre-order · Dhaka
              </div>
              <h1 className="mt-4 max-w-lg font-display text-3xl font-semibold leading-[1.02] tracking-tight text-vv-ink sm:text-5xl">
                Bringing fresh vegetables
                <br />
                home every morning.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-vv-ink/76 sm:mt-5 sm:text-lg sm:leading-8">
                Order tonight between {ORDER_WINDOW.label}. We buy your vegetables at Karwan Bazar the same
                night, inspect and weigh them against your order, and our vans reach your door from{" "}
                {DELIVERY_FROM} — before the morning rush starts.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
                <Link href="/products" className="btn-primary px-7 py-3">
                  Shop vegetables <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/products?category=baskets" className="btn-outline px-7 py-3">
                  See both baskets
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 border-t border-vv-line pt-5 text-sm sm:mt-8 sm:grid-cols-3">
                <Feat icon={<Clock />} label={`Order by ${ORDER_WINDOW.closeLabel}`} />
                <Feat icon={<Sunrise />} label={`Delivered from ${DELIVERY_FROM}`} />
                <Feat icon={<MapPin />} label={`${DELIVERY_ZONES.length} Dhaka areas`} />
              </div>
            </div>
          </div>

          <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] border border-vv-line bg-white shadow-lift sm:min-h-[440px] lg:min-h-[560px]">
            <Image
              src={HOME_HERO_IMAGE.src}
              alt={HOME_HERO_IMAGE.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-vv-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="mb-8">
            <span className="text-xs font-medium uppercase tracking-wider text-vv-leafDark">
              From your order to your door
            </span>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              One night. Four steps.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <ShoppingBasket />,
                time: ORDER_WINDOW.label,
                title: "You order",
                body: "Pick individual vegetables or a ready basket. The order window closes at midnight.",
              },
              {
                icon: <Truck />,
                time: "Overnight",
                title: "We source",
                body: "We buy only what was ordered, from trusted farmers and wholesalers at Karwan Bazar.",
              },
              {
                icon: <PackageCheck />,
                time: "Before dawn",
                title: "We check & pack",
                body: "Every item is inspected, graded, sorted, weighed, and packed to your specific order.",
              },
              {
                icon: <Sunrise />,
                time: `From ${DELIVERY_FROM}`,
                title: "We deliver",
                body: `Our vans run ${DELIVERY_ZONES.length} routes across Dhaka and bring it to your door.`,
              },
            ].map((s, i) => (
              <div key={s.title} className="card flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vv-leaf/10 text-vv-leafDark [&>*]:h-5 [&>*]:w-5">
                    {s.icon}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-vv-mute">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-vv-leafDark">{s.time}</div>
                  <div className="mt-1 font-display text-xl font-semibold">{s.title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-vv-ink/70">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:pb-14 sm:pt-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Shop by category</h2>
          <Link href="/products" className="text-sm text-vv-leafDark hover:underline">
            See everything →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c.id}
              href={`/products?category=${c.id}`}
              className="card group flex flex-col items-start justify-between gap-6 p-5 transition hover:-translate-y-1 hover:border-vv-leaf hover:shadow-lift"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-vv-leafDark">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="font-display text-xl font-semibold">{c.label}</div>
                <div className="text-xs text-vv-mute">{c.blurb}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-vv-leafDark">
              Tonight&apos;s order window
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Popular this week
            </h2>
          </div>
          <Link href="/products" className="text-sm text-vv-leafDark hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {presentHomepageProducts(featured).map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* PROMISE */}
      <section className="mx-auto mb-20 mt-0 max-w-7xl px-4">
        <div className="overflow-hidden rounded-3xl bg-vv-ink p-10 text-white lg:p-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-vv-leaf">
                The VeggieVan promise
              </span>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Bazar-fresh, without the bazar trip.
              </h2>
              <p className="mt-4 max-w-lg text-white/70">
                Because we buy against confirmed orders instead of stocking a warehouse, nothing sits around
                waiting to be sold. You get the same produce you would have picked yourself at Karwan Bazar —
                inspected, graded, and weighed — without leaving home.
              </p>
              <Link href="/products" className="mt-6 inline-flex btn-primary">
                Start your order
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Delivery areas in Dhaka", v: String(DELIVERY_ZONES.length) },
                { k: "Doorstep delivery begins", v: DELIVERY_FROM },
                { k: "Saving on every basket", v: "10–11%" },
                { k: "Complaints resolved within", v: "72h" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-white/5 p-5">
                  <div className="font-display text-3xl font-semibold text-vv-yellow">{s.v}</div>
                  <div className="mt-1 text-sm text-white/60">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Feat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-vv-ink/78">
      <span className="text-vv-leafDark [&>*]:h-4 [&>*]:w-4">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
