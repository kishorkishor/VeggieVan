"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire to your error reporter (Sentry, etc.) here.
    console.error("admin error:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-12 max-w-md">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-vv-red/10 text-vv-red">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Something broke</h2>
        <p className="mt-1 text-sm text-vv-mute">
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-vv-mute">
            ref: {error.digest}
          </p>
        )}
        <button onClick={reset} className="btn-primary mt-6">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
