import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="flex min-h-dvh flex-col justify-center bg-gray-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Set up your shop
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This appears on every listing you create.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={createShop} className="space-y-4">
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-900"
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-900"
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-gray-800"
          >
            Create shop
          </button>
        </form>
      </div>
    </main>
  );
}
