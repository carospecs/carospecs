import { Logo } from "@/app/_components/logo";
import { login, signup } from "./actions";
import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="cs-surface flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <span className="hidden text-sm font-medium text-slate-500 sm:block">
          For salvage yards
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              List parts in seconds
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Snap a photo, let AI identify the part, and post a ready-to-sell
              listing — no expertise required.
            </p>
          </div>

          <div className="cs-card rounded-2xl p-6">
            {message && (
              <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {message}
              </p>
            )}
            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <form className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@shop.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
              </div>

              <button
                formAction={login}
                className="cs-btn w-full rounded-xl px-4 py-3 text-base font-semibold text-white"
              >
                Sign in
              </button>
              <button
                formAction={signup}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Create account
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              OR
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <GoogleButton />
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            By continuing you agree to list parts you&apos;re authorized to sell.
          </p>
        </div>
      </div>
    </main>
  );
}
