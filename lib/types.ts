// Canonical AI output schema for the vehicle-intake flow.
// Multiple photos of one car -> vehicle identity + a list of visible parts.
export type Condition = "good" | "fair" | "poor";
export type Confidence = "high" | "low";

const CONDITIONS: Condition[] = ["good", "fair", "poor"];

export interface VehicleInfo {
  make: string | null;
  model: string | null;
  year_range: string | null;
  trim: string | null;
  body_style: string | null;
  vin: string | null;
  confidence: Confidence;
}

export interface PartAssessment {
  part_name: string;
  part_category: string;
  condition: Condition;
  condition_notes: string | null;
  suggested_price: number | null;
  confidence: Confidence;
}

export interface VehicleReport {
  vehicle: VehicleInfo;
  parts: PartAssessment[];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function price(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return isFinite(n) ? n : null;
  }
  return null;
}

function condition(v: unknown): Condition {
  return CONDITIONS.includes(v as Condition) ? (v as Condition) : "fair";
}

function confidence(v: unknown): Confidence {
  return v === "high" ? "high" : "low";
}

export function normalizePart(raw: unknown): PartAssessment {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    part_name: str(o.part_name) ?? "Unknown part",
    part_category: str(o.part_category) ?? "Unknown",
    condition: condition(o.condition),
    condition_notes: str(o.condition_notes),
    suggested_price: price(o.suggested_price),
    confidence: confidence(o.confidence),
  };
}

// Coerce whatever GPT-4o returned into the canonical shape. Never throws.
export function normalizeVehicleReport(raw: unknown): VehicleReport {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = (o.vehicle ?? {}) as Record<string, unknown>;
  const partsRaw = Array.isArray(o.parts) ? o.parts : [];

  return {
    vehicle: {
      make: str(v.make),
      model: str(v.model),
      year_range: str(v.year_range),
      trim: str(v.trim),
      body_style: str(v.body_style),
      vin: str(v.vin),
      confidence: confidence(v.confidence),
    },
    parts: partsRaw.map(normalizePart),
  };
}
