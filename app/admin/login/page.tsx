"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Leaf, Lock } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});
type Form = z.infer<typeof schema>;

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-vv-mute">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!res || res.error) {
      setServerError("Invalid email or password");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vv-leaf text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold leading-none">VeggieVan Admin</div>
            <div className="text-xs text-vv-mute">Sign in to continue</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="admin@veggievan.local"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-vv-red">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-vv-red">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-xl bg-vv-red/10 px-3 py-2 text-xs text-vv-red">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            <Lock className="h-4 w-4" /> {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-vv-mute">
          <div className="h-px flex-1 bg-vv-line" />
          or
          <div className="h-px flex-1 bg-vv-line" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="btn-outline w-full"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="mt-6 rounded-xl border border-dashed border-vv-line bg-vv-cream p-3 text-xs text-vv-mute">
          <div className="mb-1 font-medium text-vv-ink">Demo accounts</div>
          <div>
            <span className="font-mono">admin@veggievan.local</span> / admin123 — full access
          </div>
          <div>
            <span className="font-mono">staff@veggievan.local</span> / staff123 — orders only
          </div>
          <div className="mt-2 text-[11px]">
            Google sign-in requires your email in the allowlist (see
            <span className="font-mono"> lib/admin-users.ts</span>).
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C40.9 36.2 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
