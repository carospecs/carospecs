import OpenAI from "openai";
import { type AiOutput, normalizeAiOutput } from "@/lib/types";

// Exact system prompt from CLAUDE.md — do not edit without updating the spec.
const SYSTEM_PROMPT = `You are an expert auto parts identifier for salvage yards.
Analyze the photo and return ONLY a JSON object — no explanation, no markdown, no preamble.

Return exactly this shape:
{
  "part_name": "Common name of the part (e.g. Alternator, Front Bumper Cover)",
  "part_category": "Category (e.g. Electrical, Body, Engine, Suspension, Brakes)",
  "make_compatibility": ["List of vehicle makes this part is likely compatible with"],
  "year_range": "Estimated year range (e.g. 2012-2018) or null if unknown",
  "condition": "good | fair | poor",
  "suggested_price": "Estimated resale price in USD as a number, or null if unknown",
  "confidence": "high | low",
  "vin": "VIN number if visible in the photo, otherwise null"
}

Condition rubric:
- good: No visible damage. Fully functional cosmetically and mechanically. Minor wear expected.
- fair: Minor damage (small dents, scratches, surface rust) that does not affect function.
- poor: Visible structural damage, cracks, broken pieces, or missing components.

If you are not confident about any field, set confidence to "low" and still fill every field
with your best guess. Never return null for part_name or condition.
If the image is not a car part, return confidence "low" and part_name "Unknown".`;

let client: OpenAI | null = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Sends a base64 data URL to GPT-4o Vision and returns the normalized output.
// Throws if the API call fails (caller handles the user-facing error + admin alert).
export async function identifyPart(imageDataUrl: string): Promise<AiOutput> {
  const completion = await openai().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify this auto part." },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Model returned non-JSON despite instructions — treat as low confidence.
    parsed = {};
  }
  return normalizeAiOutput(parsed);
}
