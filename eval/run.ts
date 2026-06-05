/**
 * Phase 0 eval harness — the "referee" for L/R side classification.
 *
 * Runs the REAL production pipeline (POST /api/identify) over a frozen, hand-/
 * source-labeled golden set and prints:
 *   - a confusion matrix (truth LH/RH  ×  predicted LH/RH/UNDET)
 *   - per-side accuracy (so accuracy can't be gamed by always guessing one side)
 *   - the L→R and R→L counts (the specific bug we're chasing)
 *   - a list of every mismatch with its source URL for auditing
 *
 * It does NOT label anything itself. Ground truth comes only from the manifest
 * (sourced from listings that explicitly state the side). See README.md.
 *
 * Run with the dev server up on :3000:
 *   node eval/run.ts            (Node >= 23.6 runs .ts directly)
 *   API_BASE=http://localhost:3000 node eval/run.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE ?? "http://localhost:3000";
const MANIFEST = process.env.EVAL_MANIFEST
  ? path.resolve(process.env.EVAL_MANIFEST)
  : path.join(HERE, "golden", "manifest.json");

type Side = "LH" | "RH" | "none";
interface GoldenItem {
  id: string;
  file: string; // relative to eval/
  partType: string; // e.g. "headlight", "door", "mirror", "fender"
  side: Side; // ground truth from the source listing
  view?: string;
  condition?: "Good" | "Poor";
  sourceUrl?: string;
  title?: string;
}
interface AIPart {
  partName: string;
  partCategory: string;
  condition: string;
  confidence: string;
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Extract the side word the pipeline put into a part name. */
function sideOf(name: string): Side {
  const n = name.toLowerCase();
  if (/\bleft\b/.test(n)) return "LH";
  if (/\bright\b/.test(n)) return "RH";
  return "none";
}

/** Pick the predicted part that best matches the labeled part type. */
function pickPart(parts: AIPart[], partType: string): AIPart | undefined {
  if (parts.length === 0) return undefined;
  const t = partType.toLowerCase();
  const tokens = t.split(/\s+/);
  const hit = parts.find((p) => {
    const n = p.partName.toLowerCase();
    return tokens.some((tok) => tok && n.includes(tok));
  });
  return hit ?? parts[0]; // fall back to the most prominent
}

interface DebugPart {
  partName: string;
  imageSide: string | null;
  computedSide: string | null;
}
interface IdentifyResult {
  parts: AIPart[];
  vehicleFront?: string;
  debug?: DebugPart[];
}

async function identify(
  absFile: string
): Promise<IdentifyResult | { error: string }> {
  const ext = path.extname(absFile).toLowerCase();
  const mime = MIME[ext] ?? "image/jpeg";
  let buf: Buffer;
  try {
    buf = await readFile(absFile);
  } catch (e) {
    return { error: `read failed: ${(e as Error).message}` };
  }
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  try {
    const res = await fetch(`${API_BASE}/api/identify?debug=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: dataUrl }),
    });
    const json = (await res.json()) as
      | { ok: true; data: AIPart[]; vehicleFront?: string; parts?: DebugPart[] }
      | { ok: false; internalError?: string };
    if (!json.ok) return { error: json.internalError ?? "api not ok" };
    return { parts: json.data, vehicleFront: json.vehicleFront, debug: json.parts };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function main() {
  const items: GoldenItem[] = JSON.parse(await readFile(MANIFEST, "utf8"));
  if (items.length === 0) {
    console.log(
      "Golden set is empty. Populate eval/golden/manifest.json (see README) first."
    );
    return;
  }
  console.log(`Running ${items.length} golden images against ${API_BASE}…\n`);

  // confusion[truth][pred]
  const cm = {
    LH: { LH: 0, RH: 0, none: 0 },
    RH: { LH: 0, RH: 0, none: 0 },
  };
  const mismatches: string[] = [];
  const trace: any[] = [];
  let errors = 0;

  for (const it of items) {
    const abs = path.join(HERE, it.file);
    const result = await identify(abs);
    if ("error" in result) {
      errors++;
      console.log(`  [err] ${it.id}: ${result.error}`);
      continue;
    }
    const part = pickPart(result.parts, it.partType);
    const pred: Side = part ? sideOf(part.partName) : "none";
    const dbg = result.debug?.find((d) => d.partName === part?.partName);
    if (it.side === "LH" || it.side === "RH") {
      cm[it.side][pred]++;
      trace.push({
        id: it.id,
        truth: it.side,
        pred,
        partName: part?.partName ?? null,
        vehicleFront: result.vehicleFront ?? null,
        imageSide: dbg?.imageSide ?? null,
        computedSide: dbg?.computedSide ?? null,
        title: it.title,
      });
      if (pred !== it.side) {
        const obs = `vehicleFront=${result.vehicleFront ?? "?"} imageSide=${
          dbg?.imageSide ?? "?"
        } → computed=${dbg?.computedSide ?? "none"}`;
        mismatches.push(
          `  ${it.id}  truth=${it.side} pred=${pred}  "${part?.partName ?? "—"}"\n        ${obs}`
        );
      }
    }
  }

  const tot = (s: "LH" | "RH") => cm[s].LH + cm[s].RH + cm[s].none;
  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "—");

  console.log("\nConfusion matrix (rows = truth, cols = predicted):");
  console.log("           pred LH   pred RH   UNDET");
  for (const s of ["LH", "RH"] as const) {
    console.log(
      `  truth ${s}   ${String(cm[s].LH).padStart(6)}   ${String(
        cm[s].RH
      ).padStart(6)}   ${String(cm[s].none).padStart(5)}`
    );
  }

  console.log("\nPer-side accuracy (correct / labeled):");
  console.log(`  LH: ${pct(cm.LH.LH, tot("LH"))}%  (${cm.LH.LH}/${tot("LH")})`);
  console.log(`  RH: ${pct(cm.RH.RH, tot("RH"))}%  (${cm.RH.RH}/${tot("RH")})`);

  const labeled = tot("LH") + tot("RH");
  const correct = cm.LH.LH + cm.RH.RH;
  const undet = cm.LH.none + cm.RH.none;
  console.log(
    `\nOverall side accuracy: ${pct(correct, labeled)}%  (${correct}/${labeled})`
  );
  console.log(`  L→R errors: ${cm.LH.RH}   R→L errors: ${cm.RH.LH}`);
  console.log(
    `  Undetermined (pipeline declined to assign a side): ${undet}/${labeled}`
  );
  if (errors) console.log(`  API/read errors: ${errors}`);

  if (mismatches.length) {
    console.log(`\nMismatches (${mismatches.length}):`);
    console.log(mismatches.join("\n"));
  }

  const dump = path.join(HERE, "last-run.json");
  await writeFile(dump, JSON.stringify(trace, null, 2));
  console.log(`\nFull per-case trace written to ${dump}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
