import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyVehicle } from "@/lib/identify";

export const maxDuration = 60; // Several images through GPT-4o Vision takes longer.

// POST { paths: string[] }  ->  { report, photo_paths }
// `paths` are storage object keys the client just uploaded, all under "{uid}/...".
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let paths: unknown;
  try {
    ({ paths } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    !paths.every((p) => typeof p === "string" && p)
  ) {
    return NextResponse.json({ error: "missing_paths" }, { status: 400 });
  }
  if (paths.length > 8) {
    return NextResponse.json({ error: "too_many_photos" }, { status: 400 });
  }

  // Defense in depth: a user may only read photos in their own folder.
  if (!paths.every((p: string) => p.startsWith(`${user.id}/`))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dataUrls: string[] = [];
  for (const path of paths as string[]) {
    const { data: blob, error: dlError } = await supabase.storage
      .from("part-photos")
      .download(path);
    if (dlError || !blob) {
      return NextResponse.json({ error: "photo_not_found" }, { status: 404 });
    }
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const mime = blob.type || "image/jpeg";
    dataUrls.push(`data:${mime};base64,${base64}`);
  }

  try {
    const report = await identifyVehicle(dataUrls);
    return NextResponse.json({ report, photo_paths: paths });
  } catch (err) {
    console.error("[identify] GPT-4o vehicle call failed:", err);
    return NextResponse.json({ error: "identify_failed" }, { status: 502 });
  }
}
