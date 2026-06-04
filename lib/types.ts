// Canonical AI output schema — mirrors CLAUDE.md. Do not deviate.
export type Condition = "good" | "fair" | "poor";
export type Confidence = "high" | "low";

export interface AiOutput {
  part_name: string;
  part_category: string;
  make_compatibility: string[];
  year_range: string | null;
  condition: Condition;
  suggested_price: number | null;
  confidence: Confidence;
  vin: string | null;
}

const CONDITIONS: Condition[] = ["good", "fair", "poor"];

// Coerce whatever GPT-4o returned into the canonical shape. Never throws.
// Per spec: never return null for part_name or condition; if unsure, confidence "low".
export function normalizeAiOutput(raw: unknown): AiOutput {
  const o = (raw ?? {}) as Record<string, unknown>;

  const part_name =
    typeof o.part_name === "string" && o.part_name.trim()
      ? o.part_name.trim()
      : "Unknown";

  const part_category =
    typeof o.part_category === "string" && o.part_category.trim()
      ? o.part_category.trim()
      : "Unknown";

  const make_compatibility = Array.isArray(o.make_compatibility)
    ? o.make_compatibility.filter((m): m is string => typeof m === "string")
    : [];

  const year_range =
    typeof o.year_range === "string" && o.year_range.trim()
      ? o.year_range.trim()
      : null;

  const condition: Condition = CONDITIONS.includes(o.condition as Condition)
    ? (o.condition as Condition)
    : "fair";

  let suggested_price: number | null = null;
  if (typeof o.suggested_price === "number" && isFinite(o.suggested_price)) {
    suggested_price = o.suggested_price;
  } else if (typeof o.suggested_price === "string") {
    const n = parseFloat(o.suggested_price.replace(/[^0-9.]/g, ""));
    suggested_price = isFinite(n) ? n : null;
  }

  const confidence: Confidence = o.confidence === "high" ? "high" : "low";

  const vin =
    typeof o.vin === "string" && o.vin.trim() ? o.vin.trim() : null;

  return {
    part_name,
    part_category,
    make_compatibility,
    year_range,
    condition,
    suggested_price,
    confidence,
    vin,
  };
}
