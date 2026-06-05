/**
 * Collector — downloads images listed in eval/seed.json into eval/images/ and
 * writes eval/golden/manifest.json.
 *
 * IMPORTANT: this does NOT label anything. Each seed entry must already carry a
 * `side` that came from the SOURCE (e.g. a parts-listing title that says
 * "LH/Left/Driver" or "RH/Right/Passenger") plus the `sourceUrl` so the label
 * is auditable. We never infer the side ourselves — that would poison the
 * referee. See README.md.
 *
 * seed.json entry shape:
 *   { "id": "ebay-accord-hl-001", "url": "https://…/photo.jpg",
 *     "side": "LH" | "RH" | "none", "partType": "headlight",
 *     "view": "isolated", "condition": "Good", "sourceUrl": "https://…/listing" }
 *
 * Run: node eval/collect.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(HERE, "seed.json");
const IMAGES = path.join(HERE, "images");
const MANIFEST = path.join(HERE, "golden", "manifest.json");

interface Seed {
  id: string;
  url: string;
  side: "LH" | "RH" | "none";
  partType: string;
  view?: string;
  condition?: string;
  sourceUrl?: string;
}

function extFromUrl(url: string, contentType?: string): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("jpeg")) return ".jpg";
  const m = url.split("?")[0].match(/\.(jpg|jpeg|png|webp)$/i);
  return m ? `.${m[1].toLowerCase()}` : ".jpg";
}

async function main() {
  const seeds: Seed[] = JSON.parse(await readFile(SEED, "utf8"));
  await mkdir(IMAGES, { recursive: true });
  await mkdir(path.join(HERE, "golden"), { recursive: true });

  const manifest: any[] = [];
  let ok = 0;
  for (const s of seeds) {
    try {
      const res = await fetch(s.url, {
        headers: { "User-Agent": "Mozilla/5.0 (CaroSpecs eval collector)" },
      });
      if (!res.ok) {
        console.log(`  [skip] ${s.id}: HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/")) {
        console.log(`  [skip] ${s.id}: not an image (${ct})`);
        continue;
      }
      const ext = extFromUrl(s.url, ct);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join("images", `${s.id}${ext}`);
      await writeFile(path.join(HERE, file), buf);
      manifest.push({
        id: s.id,
        file,
        partType: s.partType,
        side: s.side,
        view: s.view ?? "isolated",
        condition: s.condition,
        sourceUrl: s.sourceUrl,
      });
      ok++;
      console.log(`  [ok]   ${s.id} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`  [err]  ${s.id}: ${(e as Error).message}`);
    }
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nDownloaded ${ok}/${seeds.length}. Manifest: ${MANIFEST}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
