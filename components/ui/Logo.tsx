import Link from "next/link";

/**
 * VeggieVan wordmark.
 *
 * TO DROP IN THE REAL LOGO: save it as `public/logo.svg` (or .png), then
 * uncomment the <Image> below and the two imports it needs. The `size` prop is
 * already threaded through every call site, so nothing else has to change.
 *
 *   import Image from "next/image";
 *   <Image src="/logo.svg" alt="" width={size} height={size} priority
 *          className="transition-transform duration-300 group-hover:-rotate-6" />
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="VeggieVan home">
      <span
        aria-hidden
        style={{ height: size, width: size }}
        className="flex shrink-0 items-center justify-center rounded-xl bg-vv-leaf/12 text-vv-leafDark transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
      >
        {/* Placeholder glyph — replaced by the real logo file, see above. */}
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" aria-hidden>
          <path
            d="M2 8h9v7H2zM11 10h5.2l2.8 3.2V15h-8z"
            fill="currentColor"
            opacity=".9"
          />
          <circle cx="6.5" cy="16.5" r="2" fill="currentColor" />
          <circle cx="15.5" cy="16.5" r="2" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight text-vv-ink">
        Veggie<span className="italic text-vv-leaf">Van</span>
      </span>
    </Link>
  );
}
