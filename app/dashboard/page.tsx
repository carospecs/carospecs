import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // No shop profile yet → finish onboarding first.
  // RLS (is_shop_member) scopes this to shops the user belongs to.
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, location")
    .limit(1)
    .maybeSingle();
  if (!shop) redirect("/onboarding");

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
        <div>
          <p className="text-base font-semibold text-gray-900">{shop.name}</p>
          {shop.location && (
            <p className="text-xs text-gray-500">{shop.location}</p>
          )}
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mx-auto w-full max-w-sm px-5 py-8">
        <Link
          href="/list"
          className="block w-full rounded-xl bg-gray-900 px-4 py-5 text-center text-lg font-semibold text-white"
        >
          + List a Part
        </Link>
        <p className="mt-3 text-center text-xs text-gray-400">
          Recent listings feed arrives in Step 8.
        </p>
      </section>
    </main>
  );
}
