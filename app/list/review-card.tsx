"use client";

import { useRef, useState } from "react";
import type { AiOutput, Condition } from "@/lib/types";
import { saveListing } from "./actions";

const CONDITIONS: Condition[] = ["good", "fair", "poor"];

export function ReviewCard({
  aiOutput,
  photoPath,
  previewUrl,
  manual,
  onReset,
}: {
  aiOutput: AiOutput;
  photoPath: string | null;
  previewUrl: string | null;
  manual: boolean; // true when employee chose "Enter manually" (no AI output to preserve)
  onReset: () => void;
}) {
  const isLow = aiOutput.confidence === "low";

  const [partName, setPartName] = useState(aiOutput.part_name);
  const [category, setCategory] = useState(aiOutput.part_category);
  const [makes, setMakes] = useState<string[]>(aiOutput.make_compatibility);
  const [makeDraft, setMakeDraft] = useState("");
  const [yearRange, setYearRange] = useState(aiOutput.year_range ?? "");
  const [condition, setCondition] = useState<Condition>(aiOutput.condition);
  const [price, setPrice] = useState(
    aiOutput.suggested_price != null ? String(aiOutput.suggested_price) : "",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const firstFieldRef = useRef<HTMLDivElement>(null);

  function addMake() {
    const v = makeDraft.trim();
    if (v && !makes.includes(v)) setMakes([...makes, v]);
    setMakeDraft("");
  }
  function removeMake(m: string) {
    setMakes(makes.filter((x) => x !== m));
  }

  async function handleSave() {
    setError(null);

    if (!partName.trim()) {
      setError("Part name is required.");
      firstFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    let suggested_price: number | null = null;
    if (price.trim() !== "") {
      const n = Number(price);
      if (!isFinite(n) || n < 0) {
        setError("Enter a valid price, or leave it blank.");
        return;
      }
      suggested_price = n;
    }

    const corrected: AiOutput = {
      part_name: partName.trim(),
      part_category: category.trim() || "Unknown",
      make_compatibility: makes,
      year_range: yearRange.trim() || null,
      condition,
      suggested_price,
      confidence: aiOutput.confidence,
      vin: aiOutput.vin,
    };

    setSaving(true);
    const res = await saveListing({
      photo_path: photoPath,
      ai_output: manual ? null : aiOutput,
      corrected_output: corrected,
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="space-y-4 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✓
        </div>
        <p className="text-lg font-semibold text-ink">Saved as draft</p>
        <p className="text-sm text-slate-500">
          Your listing is saved. Post it to your marketplace, or list the next part.
        </p>
        <button
          onClick={onReset}
          className="cs-btn w-full rounded-xl px-4 py-3 text-base font-semibold text-white"
        >
          List another part
        </button>
      </div>
    );
  }

  const fieldHighlight = isLow ? "ring-2 ring-amber-300" : "";

  return (
    <div
      className={`space-y-5 rounded-2xl border p-4 ${
        isLow ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-white"
      }`}
    >
      {isLow && (
        <div className="rounded-lg bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
          AI wasn&apos;t sure — please review carefully.
        </div>
      )}

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Part"
          className="max-h-48 w-full rounded-lg border border-gray-200 object-contain"
        />
      )}

      {/* Part name */}
      <div ref={firstFieldRef}>
        <Label>Part name</Label>
        <input
          value={partName}
          onChange={(e) => setPartName(e.target.value)}
          placeholder="e.g. Alternator"
          className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-lg font-semibold text-gray-900 outline-none focus:border-gray-900 ${fieldHighlight}`}
        />
      </div>

      {/* Category */}
      <div>
        <Label>Category</Label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Electrical"
          className={`w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 ${fieldHighlight}`}
        />
      </div>

      {/* Make compatibility */}
      <div>
        <Label>Compatible makes</Label>
        <div className={`rounded-lg border border-gray-300 p-2 ${fieldHighlight}`}>
          <div className="mb-2 flex flex-wrap gap-2">
            {makes.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
              >
                {m}
                <button
                  type="button"
                  onClick={() => removeMake(m)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label={`Remove ${m}`}
                >
                  ×
                </button>
              </span>
            ))}
            {makes.length === 0 && (
              <span className="px-1 py-1 text-sm text-gray-400">None yet</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={makeDraft}
              onChange={(e) => setMakeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMake();
                }
              }}
              placeholder="Add a make (e.g. Toyota)"
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
            <button
              type="button"
              onClick={addMake}
              className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Year range */}
      <div>
        <Label>Year range</Label>
        <input
          value={yearRange}
          onChange={(e) => setYearRange(e.target.value)}
          placeholder="e.g. 2012-2018"
          className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 outline-none focus:border-gray-900 ${fieldHighlight}`}
        />
      </div>

      {/* Condition toggle */}
      <div>
        <Label>Condition</Label>
        <div className={`grid grid-cols-3 gap-2 ${isLow ? "rounded-lg p-0.5 " + fieldHighlight : ""}`}>
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={`rounded-lg border px-3 py-3 text-sm font-semibold capitalize ${
                condition === c
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <Label>Suggested price</Label>
        <div className="flex items-center gap-2">
          <span className="text-lg text-gray-500">$</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Enter a price"
            className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 outline-none focus:border-gray-900 ${fieldHighlight}`}
          />
        </div>
      </div>

      {/* VIN (read-only) */}
      {aiOutput.vin && (
        <div>
          <Label>VIN (from photo)</Label>
          <p className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-700">
            {aiOutput.vin}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="cs-btn w-full rounded-xl px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save listing"}
        </button>
        {isLow && (
          <button
            type="button"
            onClick={() =>
              firstFieldRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }
            className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-base font-medium text-amber-800"
          >
            Fix first
          </button>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-gray-700">{children}</label>
  );
}
