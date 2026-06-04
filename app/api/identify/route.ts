import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyPart } from "@/lib/identify";

export const maxDuration = 30; // GPT-4o Vision can take a few seconds.

// POST { path: string }  ->  { ai_output, photo_path }
// `path` is a storage object key the client just uploaded, e.g. "{uid}/abc.jpg".
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let path: unknown;
  try {
    ({ path } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "missing_path" }, { status: 400 });
  }

  // Defense in depth: a user may only identify photos in their own folder.
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: blob, error: dlError } = await supabase.storage
    .from("part-photos")
    .download(path);

  if (dlError || !blob) {
    return NextResponse.json({ error: "photo_not_found" }, { status: 404 });
  }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const mime = blob.type || "image/jpeg";
  const dataUrl = `data:${mime};base64,${base64}`;

  try {
    const ai_output = await identifyPart(dataUrl);
    return NextResponse.json({ ai_output, photo_path: path });
  } catch (err) {
    // Step 6 adds the silent admin-email alert here. For now, log + friendly error.
    console.error("[identify] GPT-4o call failed:", err);
    return NextResponse.json({ error: "identify_failed" }, { status: 502 });
  }
}
