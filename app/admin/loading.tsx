import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-vv-mute">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    </div>
  );
}
