"use server";

import { createClient } from "@/lib/supabase/server";
import type { AiOutput } from "@/lib/types";

type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Inserts a listing, preserving the original AI output alongside the
// employee's corrected values. shop_id is resolved server-side from the
// authenticated user (never trusted from the client).
export async function saveListing(payload: {
  photo_path: string | null;
  ai_output: AiOutput | null; // null when the employee entered manually
  corrected_output: AiOutput;
}): Promise<SaveResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out. Please sign in again." };

  // RLS (is_shop_member) scopes this to the shop the user belongs to.
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!shop) return { ok: false, error: "No shop profile found." };

  const c = payload.corrected_output;
  const { data, error } = await supabase
    .from("listings")
    .insert({
      shop_id: shop.id,
      created_by: user.id,
      // photo_url and ai_output are NOT NULL. For manual entries (no photo,
      // no AI pass) fall back to "" / the corrected values.
      photo_url: payload.photo_path ?? "",
      ai_output: payload.ai_output ?? c,
      corrected: c,
      vin: c.vin,
      price_usd: c.suggested_price,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}
