"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Facebook } from "lucide-react";
import { DELIVERY_ZONES, DELIVERY_FROM } from "@/lib/delivery";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <footer id="contact" className="scroll-mt-24 border-t border-vv-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-vv-mute">
            Morning delivery from {DELIVERY_FROM}.
          </p>
          <address className="mt-4 max-w-xs text-sm not-italic text-vv-mute">
            House 24, Road 7, Block D
            <br />
            Bashundhara R/A, Dhaka 1229
            <br />
            Bangladesh
          </address>
          {/* Business-owned phone, WhatsApp, email, and social links are not yet
              supplied. The founders' personal numbers and university emails in
              the business plan are deliberately not published here. */}
          <div className="mt-4 flex gap-2">
            <a className="btn-ghost" href="#" aria-label="Facebook">
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>
        {[
          { title: "Shop", links: [
            { href: "/products", label: "All vegetables" },
            { href: "/products?category=baskets", label: "Baskets" },
            { href: "/#how-it-works", label: "How it works" },
            { href: "/#delivery-areas", label: "Delivery areas" },
          ]},
          { title: "Delivery areas", links: DELIVERY_ZONES.map((zone) => ({
            href: "/#delivery-areas",
            label: zone,
          }))},
          { title: "Support", links: [
            { href: "/#how-it-works", label: "How it works" },
            { href: "/#contact", label: "Contact" },
          ]},
        ].map((col) => (
          <div key={col.title}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-vv-mute">
              {col.title}
            </div>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-vv-ink/80 hover:text-vv-leafDark">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-vv-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-vv-mute sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} VeggieVan. All rights reserved.</span>
          <span>Made by Shafayat Uddin</span>
        </div>
      </div>
    </footer>
  );
}
