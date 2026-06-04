"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VehicleReport } from "@/lib/types";
import { VehicleReportCard } from "./vehicle-report";

type Phase = "capture" | "analyzing" | "result" | "error";
type Photo = { file: File; url: string };

const MAX_PHOTOS = 8;
const SUGGESTED = ["Front", "Rear", "Driver side", "Passenger side", "Interior", "VIN plate"];

export default function ListVehiclePage() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [report, setReport] = useState<VehicleReport | null>(null);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [slow, setSlow] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, [phase]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const f of picked) {
        if (next.length >= MAX_PHOTOS) break;
        next.push({ file: f, url: URL.createObjectURL(f) });
      }
      return next;
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function startOver() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setReport(null);
    setPhotoPaths([]);
    setPhase("capture");
  }

  async function analyze() {
    if (photos.length === 0) return;
    setSlow(false);
    setPhase("analyzing");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const group = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i].file;
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${group}/${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("part-photos")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }

      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) throw new Error(`identify ${res.status}`);
      const json = (await res.json()) as { report: VehicleReport };
      setReport(json.report);
      setPhotoPaths(paths);
      setPhase("result");
    } catch (err) {
      console.error(err);
      setPhase("error");
    }
  }

  return (
    <main className="cs-surface min-h-dvh">
      <header className="flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-5 py-4 backdrop-blur">
        <Link href="/dashboard" className="text-sm text-slate-500 transition hover:text-ink">
          ← Back
        </Link>
        <h1 className="text-base font-semibold text-ink">Add a vehicle</h1>
      </header>

      <div className="mx-auto w-full max-w-md px-5 py-8">
        {phase === "capture" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-ink">Photograph the car</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add 4–6 clear photos from different angles. We&apos;ll identify the
                vehicle and grade the visible parts.
              </p>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={onPick}
              className="hidden"
              id="photo-input"
            />

            <div className="grid grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div
                  key={p.url}
                  className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label
                  htmlFor="photo-input"
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-500 hover:text-brand-600"
                >
                  <span className="text-2xl leading-none">＋</span>
                  <span className="text-xs font-medium">Add</span>
                </label>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Suggested: {SUGGESTED.join(" · ")}
            </p>

            <button
              onClick={analyze}
              disabled={photos.length === 0}
              className="cs-btn w-full rounded-2xl px-4 py-5 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {photos.length === 0
                ? "Add photos to continue"
                : `Analyze vehicle (${photos.length} photo${photos.length > 1 ? "s" : ""})`}
            </button>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="text-base font-medium text-ink">Identifying the vehicle…</p>
            <p className="text-sm text-slate-500">
              {slow ? "Still working — analyzing all angles." : "Reading the photos."}
            </p>
          </div>
        )}

        {phase === "result" && report && (
          <VehicleReportCard report={report} photoPaths={photoPaths} onReset={startOver} />
        )}

        {phase === "error" && (
          <div className="space-y-4 py-16 text-center">
            <p className="text-base font-medium text-ink">
              Having trouble analyzing those photos — try again.
            </p>
            <button
              onClick={analyze}
              className="cs-btn w-full rounded-xl px-4 py-3 text-base font-semibold text-white"
            >
              Try again
            </button>
            <button
              onClick={startOver}
              className="block w-full text-sm text-slate-500 underline"
            >
              Use different photos
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
