import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/app/_components/logo";
import { createShop } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If a shop already exists for this user, skip onboarding.
  // RLS (is_shop_member) scopes this to shops the user belongs to.
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (shop) redirect("/dashboard");

  return (
    <main className="cs-surface flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Logo size="sm" />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-12">
        <div className="mb-7">
          <p className="text-sm font-medium text-brand-600">Step 1 of 1</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">
            Set up your shop
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This appears on every listing you create.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={createShop} className="cs-card space-y-4 rounded-2xl p-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Shop name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Garcia Auto Salvage"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="location"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="Austin, TX"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Business phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="(512) 555-0142"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <button
            type="submit"
            className="cs-btn w-full rounded-xl px-4 py-3 text-base font-semibold text-white"
          >
            Create shop
          </button>
        </form>
      </div>
    </main>
  );
}
