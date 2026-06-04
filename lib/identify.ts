import OpenAI from "openai";
import { type VehicleReport, normalizeVehicleReport } from "@/lib/types";

// System prompt for the multi-photo vehicle intake. Given several angles of ONE
// car, identify the vehicle, then enumerate the visible, individually-sellable
// salvage parts and grade their condition. Do not invent parts you can't see.
const SYSTEM_PROMPT = `You are an expert vehicle appraiser for an auto salvage yard.
You are given several photos of a SINGLE vehicle from different angles (front, rear,
left, right, etc.). Use ALL of them together. Return ONLY a JSON object — no prose,
no markdown.

Return exactly this shape:
{
  "vehicle": {
    "make": "e.g. Toyota, or null if unsure",
    "model": "e.g. Camry, or null",
    "year_range": "e.g. 2012-2017, or null",
    "trim": "e.g. SE, or null",
    "body_style": "e.g. Sedan, SUV, Pickup, or null",
    "vin": "VIN if legible in any photo, otherwise null",
    "confidence": "high | low"
  },
  "parts": [
    {
      "part_name": "Common name, e.g. Front Bumper Cover, Left Headlight, Hood",
      "part_category": "Body | Lighting | Glass | Wheels | Mirrors | Trim | Other",
      "condition": "good | fair | poor",
      "condition_notes": "Short note grounded in what's visible, e.g. 'deep scratch, cracked tab'",
      "suggested_price": 120,
      "confidence": "high | low"
    }
  ]
}

Rules:
- Only list parts you can actually SEE and assess in the photos (exterior body panels,
  bumpers, headlights/taillights, hood, doors, fenders, mirrors, windshield/glass,
  grille, wheels, trim). Do NOT list internal mechanical parts you cannot see.
- Condition rubric: good = no visible damage; fair = minor damage (scratches, small
  dents, surface rust) not affecting use; poor = cracked, broken, heavily damaged, or missing.
- suggested_price is an estimated used-resale price in USD as a number, or null if unsure.
- Set confidence "low" on any field you are unsure about. Never invent a VIN.
- Aim for the most valuable, clearly-visible parts (typically 6-15 items).`;

let client: OpenAI | null = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Sends every photo of one vehicle to GPT-4o Vision in a single call and returns
// the normalized vehicle + parts report. Throws if the API call fails.
export async function identifyVehicle(
  imageDataUrls: string[],
): Promise<VehicleReport> {
  const completion = await openai().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here are ${imageDataUrls.length} photos of one vehicle. Identify it and assess the visible parts.`,
          },
          ...imageDataUrls.map(
            (url) =>
              ({
                type: "image_url" as const,
                image_url: { url, detail: "auto" as const },
              }),
          ),
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return normalizeVehicleReport(parsed);
}
