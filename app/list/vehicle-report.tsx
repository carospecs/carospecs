"use client";

import { useState } from "react";
import type { Condition, PartAssessment, VehicleInfo, VehicleReport } from "@/lib/types";
import { saveVehicle } from "./actions";

const CONDITIONS: Condition[] = ["good", "fair", "poor"];

type EditablePart = PartAssessment & { key: string };

export function VehicleReportCard({
  report,
  photoPaths,
  onReset,
}: {
  report: VehicleReport;
  photoPaths: string[];
  onReset: () => void;
}) {
  const [vehicle, setVehicle] = useState<VehicleInfo>(report.vehicle);
  const [parts, setParts] = useState<EditablePart[]>(
    report.parts.map((p, i) => ({ ...p, key: `p${i}` })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number } | null>(null);

  function setV<K extends keyof VehicleInfo>(k: K, v: VehicleInfo[K]) {
    setVehicle((prev) => ({ ...prev, [k]: v }));
  }
  function setPart(key: string, patch: Partial<PartAssessment>) {
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function removePart(key: string) {
    setParts((prev) => prev.filter((p) => p.key !== key));
  }
  function addPart() {
    setParts((prev) => [
      ...prev,
      {
        key: `new${Date.now()}`,
        part_name: "",
        part_category: "Other",
        condition: "fair",
        condition_notes: null,
        suggested_price: null,
        confidence: "high",
      },
    ]);
  }

  async function handleSave() {
    setError(null);
    const cleaned = parts
      .map((p) => ({ ...p, part_name: p.part_name.trim() }))
      .filter((p) => p.part_name);
    if (cleaned.length === 0) {
      setError("Add at least one part before saving.");
      return;
    }
    setSaving(true);
    const res = await saveVehicle({
      vehicle,
      parts: cleaned.map(({ key, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
      photo_paths: photoPaths,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved({ count: res.partCount });
  }

  if (saved) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✓
        </div>
        <p className="text-lg font-semibold text-ink">Vehicle saved</p>
        <p className="text-sm text-slate-500">
          {vehicleTitle(vehicle)} added with {saved.count} part
          {saved.count === 1 ? "" : "s"} as drafts.
        </p>
        <button
          onClick={onReset}
          className="cs-btn w-full rounded-xl px-4 py-3 text-base font-semibold text-white"
        >
          Add another vehicle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Vehicle identity */}
      <div className="cs-card rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-600">Vehicle</p>
          {vehicle.confidence === "low" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Low confidence — verify
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make" value={vehicle.make ?? ""} onChange={(v) => setV("make", v || null)} />
          <Field label="Model" value={vehicle.model ?? ""} onChange={(v) => setV("model", v || null)} />
          <Field label="Year" value={vehicle.year_range ?? ""} onChange={(v) => setV("year_range", v || null)} placeholder="2012-2017" />
          <Field label="Trim" value={vehicle.trim ?? ""} onChange={(v) => setV("trim", v || null)} />
          <Field label="Body style" value={vehicle.body_style ?? ""} onChange={(v) => setV("body_style", v || null)} />
          <Field label="VIN" value={vehicle.vin ?? ""} onChange={(v) => setV("vin", v || null)} mono />
        </div>
      </div>

      {/* Parts */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">
          Parts <span className="text-slate-400">({parts.length})</span>
        </h2>
        <button onClick={addPart} className="text-sm font-medium text-brand-600 hover:underline">
          + Add part
        </button>
      </div>

      <div className="space-y-3">
        {parts.map((p) => (
          <div key={p.key} className="cs-card rounded-2xl p-4">
            <div className="mb-3 flex items-start gap-2">
              <input
                value={p.part_name}
                onChange={(e) => setPart(p.key, { part_name: e.target.value })}
                placeholder="Part name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <button
                onClick={() => removePart(p.key)}
                aria-label="Remove part"
                className="mt-1 flex-none rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                value={p.part_category}
                onChange={(e) => setPart(p.key, { part_category: e.target.value })}
                placeholder="Category"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
                <span className="text-sm text-slate-400">$</span>
                <input
                  value={p.suggested_price ?? ""}
                  onChange={(e) => {
                    const n = e.target.value.trim() === "" ? null : Number(e.target.value);
                    setPart(p.key, { suggested_price: n != null && isFinite(n) ? n : null });
                  }}
                  inputMode="decimal"
                  placeholder="Price"
                  className="w-full bg-transparent py-2 text-sm text-ink outline-none"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPart(p.key, { condition: c })}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold capitalize transition ${
                    p.condition === c
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {p.condition_notes && (
              <p className="mt-2 text-xs text-slate-500">{p.condition_notes}</p>
            )}
          </div>
        ))}
        {parts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            No parts yet. Tap “Add part”.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="cs-btn w-full rounded-xl px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : `Save vehicle + ${parts.length} part${parts.length === 1 ? "" : "s"}`}
        </button>
        <button onClick={onReset} className="block w-full text-sm text-slate-500 underline">
          Discard and start over
        </button>
      </div>
    </div>
  );
}

function vehicleTitle(v: VehicleInfo) {
  return [v.year_range, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
