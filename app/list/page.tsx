"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AiOutput } from "@/lib/types";
import { ReviewCard } from "./review-card";

type Phase = "capture" | "preview" | "identifying" | "result" | "error";

const BLANK_OUTPUT: AiOutput = {
  part_name: "",
  part_category: "",
  make_compatibility: [],
  year_range: null,
  condition: "fair",
  suggested_price: null,
  confidence: "low",
  vin: null,
};

export default function ListPartPage() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [result, setResult] = useState<AiOutput | null>(null);
  const [manual, setManual] = useState(false);
  const [slow, setSlow] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (phase !== "identifying") return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [phase]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setUploadedPath(null);
    setPhase("preview");
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setUploadedPath(null);
    setResult(null);
    setManual(false);
    setPhase("capture");
    if (fileInput.current) fileInput.current.value = "";
  }

  // Calls the identify API for an already-uploaded photo.
  async function runIdentify(path: string) {
    setSlow(false);
    setPhase("identifying");
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error(`identify ${res.status}`);
      const json = (await res.json()) as { ai_output: AiOutput };
      setResult(json.ai_output);
      setManual(false);
      setPhase("result");
    } catch (err) {
      console.error(err);
      setPhase("error");
    }
  }

  // Uploads the photo, then identifies it.
  async function uploadAndIdentify() {
    if (!file) return;
    setSlow(false);
    setPhase("identifying");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("part-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      setUploadedPath(path);
      await runIdentify(path);
    } catch (err) {
      console.error(err);
      setPhase("error");
    }
  }

  function enterManually() {
    // Photo may already be uploaded (upload precedes identify); keep it if so.
    setResult(BLANK_OUTPUT);
    setManual(true);
    setPhase("result");
  }

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back
        </Link>
        <h1 className="text-base font-semibold text-gray-900">List a Part</h1>
      </header>

      <div className="mx-auto w-full max-w-sm px-5 py-8">
        {phase === "capture" && (
          <div className="space-y-6 text-center">
            <p className="text-sm text-gray-500">
              Take a photo of the part. One clear shot works best.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPick}
              className="hidden"
              id="photo-input"
            />
            <label
              htmlFor="photo-input"
              className="block w-full cursor-pointer rounded-xl bg-gray-900 px-4 py-5 text-lg font-semibold text-white"
            >
              📷 Take / choose photo
            </label>
            <button
              type="button"
              onClick={enterManually}
              className="text-sm text-gray-500 underline"
            >
              Enter manually instead
            </button>
          </div>
        )}

        {phase === "preview" && previewUrl && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Part preview"
              className="w-full rounded-xl border border-gray-200 object-contain"
            />
            <button
              onClick={uploadAndIdentify}
              className="w-full rounded-xl bg-gray-900 px-4 py-4 text-lg font-semibold text-white"
            >
              Use this photo
            </button>
            <button
              onClick={retake}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700"
            >
              Retake
            </button>
          </div>
        )}

        {phase === "identifying" && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
            <p className="text-base font-medium text-gray-900">Identifying part…</p>
            {slow && (
              <p className="text-sm text-gray-500">
                Taking longer than usual — hang tight.
              </p>
            )}
          </div>
        )}

        {phase === "result" && result && (
          <ReviewCard
            aiOutput={result}
            photoPath={uploadedPath}
            previewUrl={previewUrl}
            manual={manual}
            onReset={retake}
          />
        )}

        {phase === "error" && (
          <div className="space-y-4 py-10 text-center">
            <p className="text-base font-medium text-gray-900">
              Having trouble right now — try again in a few minutes.
            </p>
            <button
              onClick={() => (uploadedPath ? runIdentify(uploadedPath) : uploadAndIdentify())}
              className="w-full rounded-xl bg-gray-900 px-4 py-3 text-base font-semibold text-white"
            >
              Try again
            </button>
            <button
              onClick={enterManually}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700"
            >
              Enter manually
            </button>
            <button
              onClick={retake}
              className="block w-full text-sm text-gray-500 underline"
            >
              Use a different photo
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
