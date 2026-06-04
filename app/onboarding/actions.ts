"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createShop(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) {
    redirect(`/onboarding?error=${encodeURIComponent("Shop name is required.")}`);
  }

  // create_shop() is SECURITY DEFINER: it inserts the shop AND adds the caller
  // as an 'owner' in shop_members atomically. Direct inserts are blocked by RLS
  // (no insert policy on shops / shop_members).
  const { error } = await supabase.rpc("create_shop", {
    shop_name: name,
    shop_location: location || null,
    shop_phone: phone || null,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
