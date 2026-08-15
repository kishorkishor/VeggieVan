import { Leaf, ReceiptText, Truck } from "lucide-react";

const BENEFITS = [
  { icon: Truck, copy: "Sourced overnight and at your door from 7:00 AM." },
  { icon: ReceiptText, copy: "No surprise fees after you place your order." },
  { icon: Leaf, copy: "Inspected, graded, and weighed against your order." },
];

export function CheckoutReassurance() {
  return (
    <div className="mb-4 rounded-2xl border border-vv-leaf/25 bg-vv-leaf/5 p-4">
      <p className="font-display text-lg font-semibold">Fresh, secure, straightforward</p>
      <ul className="mt-3 space-y-2 text-sm text-vv-ink/75">
        {BENEFITS.map(({ icon: Icon, copy }) => (
          <li key={copy} className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-vv-leafDark" />
            <span>{copy}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
