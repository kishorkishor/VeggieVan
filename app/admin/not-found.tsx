import Link from "next/link";
import { Compass } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div className="mx-auto mt-12 max-w-md">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-vv-leaf/10 text-vv-leafDark">
          <Compass className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Page not found</h2>
        <p className="mt-1 text-sm text-vv-mute">
          That admin route doesn&apos;t exist.
        </p>
        <Link href="/admin" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
