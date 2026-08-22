"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Wallet, MapPin, Sunrise, Info } from "lucide-react";
import {
  DELIVERY_ZONES,
  DELIVERY_FROM,
  DELIVERY_WINDOW_LABEL,
  ORDER_WINDOW,
  PAYMENT_METHODS,
  type PaymentMethodId,
} from "@/lib/delivery";
import { useCart, cartTotals } from "@/lib/stores";
import { useCatalog } from "@/lib/catalog-context";
import { placeOrderAction } from "@/lib/orders/actions";
import { formatBDT, cn } from "@/lib/utils";
import { CheckoutReassurance } from "@/components/growth/CheckoutReassurance";
import { ExperimentExposure } from "@/components/growth/ExperimentExposure";
import { useGrowth } from "@/lib/growth/GrowthProvider";
import {
  checkoutStartedEvent,
  checkoutStepCompletedEvent,
} from "@/lib/growth/instrumentation";

const addressSchema = z.object({
  name: z.string().min(1, "Required"),
  phone: z
    .string()
    .regex(/^(?:\+?880|0)1[3-9]\d{8}$/, "Enter a valid mobile number, e.g. 01712345678"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  zone: z.enum(DELIVERY_ZONES, { message: "Choose your delivery area" }),
  address: z.string().min(1, "Required"),
  note: z.string().max(200).optional(),
});

type Address = z.infer<typeof addressSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items: rawItems, clear } = useCart();
  const products = useCatalog();
  // Drop cart lines whose product no longer exists (stale localStorage).
  const items = rawItems.filter((i) => products.some((p) => p.id === i.productId));
  const totals = cartTotals(items, products);
  const { ready, growth, track, variant } = useGrowth();
  const checkoutStarted = useRef(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payment, setPayment] = useState<PaymentMethodId>("cod");
  const [txnId, setTxnId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<Address>({
    resolver: zodResolver(addressSchema),
    defaultValues: { zone: DELIVERY_ZONES[0], email: "" },
  });

  useEffect(() => {
    if (!ready || items.length === 0 || checkoutStarted.current) return;
    checkoutStarted.current = true;
    track(checkoutStartedEvent(items, products));
  }, [items, products, ready, track]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Your basket is empty</h1>
        <p className="mt-2 text-vv-mute">Add a few things before checking out.</p>
        <Link href="/products" className="btn-primary mt-6 inline-flex">Shop fresh</Link>
      </div>
    );
  }

  const next = async () => {
    if (step === 1) {
      const ok = await trigger();
      if (ok) {
        track(checkoutStepCompletedEvent(1, items, products));
        setStep(2);
      }
    } else if (step === 2) {
      track(checkoutStepCompletedEvent(2, items, products));
      setStep(3);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    // Defence in depth: pressing Enter in a field on step 1 or 2 also submits
    // the form. An order must only ever be placed from the payment step.
    if (step !== 3 || submitting) return;
    setSubmitting(true);
    // DEMO ONLY. No money moves here. A real launch would confirm the bKash /
    // Nagad transaction against a merchant account before accepting the order.
    await new Promise((r) => setTimeout(r, 800));

    // The server prices the order — we only send ids and quantities.
    track(checkoutStepCompletedEvent(3, items, products));
    const res = await placeOrderAction({
      customer: {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        address: values.address,
        zone: values.zone,
        paymentMethod: payment,
      },
      items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      growth,
    });

    if (!res.ok) {
      setSubmitting(false);
      alert(res.error);
      return;
    }

    clear();
    router.push(`/checkout/success?order=${res.id}`);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ExperimentExposure experiment="checkout_reassurance_v1" />
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-vv-mute hover:text-vv-ink">
        <ArrowLeft className="h-4 w-4" /> Continue shopping
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Checkout</h1>

      {/* Steps */}
      <ol className="mt-6 flex items-center gap-3 text-sm">
        {[
          { n: 1, label: "Address", icon: MapPin },
          { n: 2, label: "Delivery", icon: Sunrise },
          { n: 3, label: "Payment", icon: Wallet },
        ].map((s, i) => (
          <li key={s.n} className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 transition",
                step >= s.n ? "bg-vv-leaf text-white" : "bg-white text-vv-mute"
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="font-medium">{s.label}</span>
            </div>
            {i < 2 && <div className="h-px w-6 bg-vv-line" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <form onSubmit={onSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.section
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6"
              >
                <h2 className="mb-4 font-display text-2xl">Delivery address</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" error={errors.name?.message}>
                    <input className="input" autoComplete="name" {...register("name")} />
                  </Field>
                  <Field label="Mobile number" error={errors.phone?.message}>
                    <input
                      className="input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="01712345678"
                      autoComplete="tel"
                      {...register("phone")}
                    />
                  </Field>
                  <Field label="Delivery area" error={errors.zone?.message}>
                    <select className="input" {...register("zone")}>
                      {DELIVERY_ZONES.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Email (optional)" error={errors.email?.message}>
                    <input className="input" type="email" autoComplete="email" {...register("email")} />
                  </Field>
                  <Field label="House, road, block / apartment" full error={errors.address?.message}>
                    <input
                      className="input"
                      placeholder="House 24, Road 7, Block D, Flat 4B"
                      autoComplete="street-address"
                      {...register("address")}
                    />
                  </Field>
                  <Field label="Note for the driver (optional)" full error={errors.note?.message}>
                    <input className="input" placeholder="Call on arrival, gate is on the side road" {...register("note")} />
                  </Field>
                </div>
                <p className="mt-4 flex gap-2 rounded-xl bg-vv-leaf/8 p-3 text-xs text-vv-ink/75">
                  <Info className="mt-px h-4 w-4 shrink-0 text-vv-leafDark" />
                  We currently deliver to {DELIVERY_ZONES.slice(0, -1).join(", ")}, and{" "}
                  {DELIVERY_ZONES.at(-1)}, plus selected surrounding neighbourhoods.
                </p>
              </motion.section>
            )}

            {step === 2 && (
              <motion.section
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6"
              >
                <h2 className="mb-1 font-display text-2xl">Tomorrow morning</h2>
                <p className="mb-5 text-sm text-vv-mute">
                  VeggieVan runs one delivery a day. Everything ordered tonight is sourced overnight and
                  reaches you the next morning — there is no slot to choose.
                </p>

                <div className="rounded-xl border border-vv-leaf bg-vv-leaf/5 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Sunrise className="h-5 w-5 text-vv-leafDark" />
                    <div>
                      <div className="font-medium">Delivery starts {DELIVERY_FROM}</div>
                      <div className="text-xs text-vv-mute">
                        Indicative window {DELIVERY_WINDOW_LABEL} · ৳40 delivery per order
                      </div>
                    </div>
                  </div>
                </div>

                <ol className="mt-5 space-y-3 border-t border-vv-line pt-5 text-sm">
                  {[
                    [`Tonight, ${ORDER_WINDOW.openLabel}–${ORDER_WINDOW.closeLabel}`, "Your order is confirmed and locked in."],
                    ["Overnight", "We buy exactly what you ordered at the wholesale market."],
                    ["Before dawn", "Inspected, graded, weighed, and packed for your address."],
                    [`From ${DELIVERY_FROM}`, "Your van reaches your door."],
                  ].map(([when, what]) => (
                    <li key={when} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vv-leaf" />
                      <span>
                        <span className="font-medium">{when}</span>
                        <span className="text-vv-mute"> — {what}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </motion.section>
            )}

            {step === 3 && (
              <motion.section
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6"
              >
                <h2 className="mb-4 font-display text-2xl">How would you like to pay?</h2>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-3 transition",
                        payment === m.id
                          ? "border-vv-leaf bg-vv-leaf/5"
                          : "border-vv-line hover:border-vv-leaf/60"
                      )}
                    >
                      <input
                        type="radio"
                        name="payment"
                        className="mt-1 accent-vv-leafDark"
                        checked={payment === m.id}
                        onChange={() => setPayment(m.id)}
                      />
                      <span>
                        <span className="block font-medium">{m.label}</span>
                        <span className="block text-xs text-vv-mute">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {payment !== "cod" && (
                  <div className="mt-4">
                    <Field label={`${payment === "bkash" ? "bKash" : "Nagad"} transaction ID`}>
                      <input
                        className="input font-mono tracking-wider"
                        placeholder="e.g. 9F7A2B4C1D"
                        value={txnId}
                        onChange={(e) => setTxnId(e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                <p className="mt-4 flex gap-2 rounded-xl border border-dashed border-vv-line bg-vv-cream p-3 text-xs text-vv-mute">
                  <Info className="mt-px h-4 w-4 shrink-0 text-vv-leafDark" />
                  Demonstration only — no payment is taken and no real order is placed. Connecting live
                  bKash or Nagad requires an approved merchant account.
                </p>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="btn-outline"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <div />
            )}
            {/* The keys matter. Without them React reuses one DOM button and
                only flips its `type`. Advancing to step 3 happens inside that
                button's own click handler, so the browser would then apply the
                default action of a now-`type="submit"` button and place the
                order the instant you left the delivery step. */}
            {step < 3 ? (
              <button key="continue" type="button" onClick={next} className="btn-primary">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button key="submit" type="submit" disabled={submitting} className="btn-primary">
                {submitting
                  ? "Placing order…"
                  : payment === "cod"
                    ? `Place order · ${formatBDT(totals.total)}`
                    : `Confirm payment · ${formatBDT(totals.total)}`}
                {!submitting && <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </form>

        {/* Summary */}
        <aside className="h-fit lg:sticky lg:top-24">
          {variant("checkout_reassurance_v1") === "treatment" && <CheckoutReassurance />}
          <div className="card p-5">
            <h3 className="font-display text-lg font-semibold">Order summary</h3>
            <ul className="mt-4 space-y-3">
              {items.map((i) => {
                const p = products.find((x) => x.id === i.productId);
                if (!p) return null;
                return (
                  <li key={i.productId} className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                      <Image src={p.images[0]} alt={p.name} fill sizes="48px" className="object-cover" />
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-vv-ink px-1 text-[10px] font-semibold text-white">
                        {i.qty}
                      </span>
                    </div>
                    <div className="flex-1 truncate text-sm">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-vv-mute">{p.unit}</div>
                    </div>
                    <div className="text-sm font-medium">{formatBDT(p.price * i.qty)}</div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-5 space-y-1 border-t border-vv-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-vv-mute">Subtotal</dt>
                <dd>{formatBDT(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-vv-mute">Delivery</dt>
                <dd>{totals.shipping === 0 ? "Free" : formatBDT(totals.shipping)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-vv-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatBDT(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  // The label wraps its control so the association is implicit — otherwise the
  // field has no accessible name for screen readers or assistive tooling.
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block">
        <span className="label">{label}</span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs text-vv-red">{error}</p>}
    </div>
  );
}
