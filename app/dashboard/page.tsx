import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/app/_components/logo";

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
    <main className="cs-surface min-h-dvh">
      <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-5 py-4 backdrop-blur">
        <Logo size="sm" />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mx-auto w-full max-w-sm px-5 py-10">
        <div className="mb-6">
          <p className="text-sm font-medium text-brand-600">Welcome back</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">
            {shop.name}
          </h1>
          {shop.location && (
            <p className="text-sm text-slate-500">{shop.location}</p>
          )}
        </div>

        <Link
          href="/list"
          className="cs-btn flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-5 text-lg font-semibold text-white"
        >
          <span className="text-xl leading-none">＋</span> List a part
        </Link>

        <div className="cs-card mt-5 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-700">How it works</p>
          <ol className="mt-3 space-y-2.5 text-sm text-slate-500">
            <li className="flex gap-3">
              <Step n={1} /> Snap or upload a photo of the part
            </li>
            <li className="flex gap-3">
              <Step n={2} /> AI fills in type, fitment, condition &amp; price
            </li>
            <li className="flex gap-3">
              <Step n={3} /> Review, tweak, and save the listing
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
      {n}
    </span>
  );
}
