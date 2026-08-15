import Link from "next/link";
import { LogoMark } from "@/components/ui/LogoMark";

/**
 * Horizontal lockup for the site chrome: the mark beside the wordmark.
 *
 * The full stacked lockup lives at public/logo.svg for print, social, and
 * anywhere the vertical arrangement fits better. The wordmark is live text
 * rather than traced outlines so it stays selectable and crisp at any size.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="VeggieVan home">
      <LogoMark
        aria-hidden
        style={{ height: size * 0.72, width: (size * 0.72 * 737) / 455 }}
        className="shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5"
      />
      <span className="font-display text-2xl font-semibold tracking-tight text-vv-forest">
        Veggie<span className="text-vv-fresh">Van</span>
      </span>
    </Link>
  );
}
