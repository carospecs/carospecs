"use server";

import { createClient } from "@/lib/supabase/server";
import type { PartAssessment, VehicleInfo } from "@/lib/types";

type SaveResult =
  | { ok: true; vehicleId: string; partCount: number }
  | { ok: false; error: string };

// Inserts a vehicle plus one listing per part. shop_id is resolved server-side
// from the authenticated user's membership (never trusted from the client).
export async function saveVehicle(payload: {
  vehicle: VehicleInfo;
  parts: PartAssessment[];
  photo_paths: string[];
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

  const { vehicle, parts, photo_paths } = payload;
  const primaryPhoto = photo_paths[0] ?? "";

  const { data: v, error: vErr } = await supabase
    .from("vehicles")
    .insert({
      shop_id: shop.id,
      created_by: user.id,
      make: vehicle.make,
      model: vehicle.model,
      year_range: vehicle.year_range,
      trim: vehicle.trim,
      body_style: vehicle.body_style,
      vin: vehicle.vin,
      confidence: vehicle.confidence,
      ai_output: { vehicle, parts },
      photo_urls: photo_paths,
      status: "draft",
    })
    .select("id")
    .single();

  if (vErr || !v) return { ok: false, error: vErr?.message ?? "Could not save vehicle." };

  if (parts.length > 0) {
    const rows = parts.map((p) => ({
      shop_id: shop.id,
      created_by: user.id,
      vehicle_id: v.id,
      photo_url: primaryPhoto,
      ai_output: p,
      corrected: p,
      vin: vehicle.vin,
      price_usd: p.suggested_price,
      other_notes: p.condition_notes,
      status: "draft",
    }));
    const { error: lErr } = await supabase.from("listings").insert(rows);
    if (lErr) {
      // Vehicle saved but parts failed — surface it rather than silently dropping.
      return { ok: false, error: `Vehicle saved, but parts failed: ${lErr.message}` };
    }
  }

  return { ok: true, vehicleId: v.id, partCount: parts.length };
}
