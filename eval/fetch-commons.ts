/**
 * Fetch freely-licensed whole-car photos from Wikimedia Commons into images/,
 * and APPEND them to the manifest with side: "pending" for a human to label.
 *
 * Append-safe: existing manifest entries (and their human labels) are preserved.
 * We never label the side here — self-labeling would poison the referee.
 *
 * Run: node eval/fetch-commons.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMAGES = path.join(HERE, "images");
const MANIFEST = path.join(HERE, "golden", "manifest.json");
const LABELHTML = path.join(HERE, "label.html");
const API = "https://commons.wikimedia.org/w/api.php";
const TARGET_TOTAL = 130; // grow the set toward this many total entries
const UA = "CaroSpecs-eval/0.1 (research; auto-parts vision eval; contact: repo owner)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// This batch is LEFT/driver-side biased — LH is the minority (17 vs 50 RH),
// so we fill the left side and the user trims RH down for a 50/50 split.
const TERMS = [
  "car front left view",
  "automobile front left three quarter",
  "sedan left side view",
  "SUV left side view",
  "car driver side view",
  "hatchback left side view",
  "pickup truck left side",
  "coupe rear left quarter",
  "car left profile view",
  "van left side view",
  "automobile left side profile",
  "sedan rear left quarter",
];

interface Row {
  id: string;
  file: string;
  partType: string;
  side: string; // "pending" for new; LH/RH/skip once labeled
  view: string;
  sourceUrl: string;
  license: string;
  title: string;
}

async function politeFetch(url: string | URL, tries = 3): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429) return res;
    await sleep(4000 * (i + 1)); // 4s, 8s, 12s backoff
  }
  return fetch(url, { headers: { "User-Agent": UA } });
}

async function search(term: string): Promise<any[]> {
  const u = new URL(API);
  u.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mediatype",
    iiurlwidth: "1024",
    origin: "*",
  }).toString();
  const res = await politeFetch(u);
  if (!res.ok) return [];
  const json = await res.json();
  return Object.values(json?.query?.pages ?? {});
}

function extOf(url: string): string {
  const m = url.split("?")[0].match(/\.(jpg|jpeg|png|webp)$/i);
  return m ? `.${m[1].toLowerCase()}` : ".jpg";
}

async function main() {
  await mkdir(IMAGES, { recursive: true });
  await mkdir(path.join(HERE, "golden"), { recursive: true });

  // Load existing manifest and preserve it (labels included).
  let existing: Row[] = [];
  if (existsSync(MANIFEST)) {
    try {
      existing = JSON.parse(await readFile(MANIFEST, "utf8"));
    } catch {
      existing = [];
    }
  }
  const seen = new Set(existing.map((r) => r.title));
  let maxId = existing.reduce((mx, r) => {
    const m = r.id.match(/(\d+)$/);
    return m ? Math.max(mx, Number(m[1])) : mx;
  }, 0);

  const added: Row[] = [];
  for (const term of TERMS) {
    if (existing.length + added.length >= TARGET_TOTAL) break;
    let pages: any[] = [];
    try {
      pages = await search(term);
      await sleep(1500);
    } catch (e) {
      console.log(`  [search err] "${term}": ${(e as Error).message}`);
      continue;
    }
    for (const p of pages) {
      if (existing.length + added.length >= TARGET_TOTAL) break;
      const info = p.imageinfo?.[0];
      if (!info || info.mediatype !== "BITMAP") continue;
      // Stored titles drop the "File:" prefix — strip it here too so dedupe works.
      const title: string = (p.title ?? "").replace(/^File:/, "");
      if (!title || seen.has(title)) continue;
      const thumb: string = info.thumburl;
      if (!thumb) continue;
      seen.add(title);
      const id = `wiki-${String(++maxId).padStart(3, "0")}`;
      try {
        await sleep(2000); // pace to avoid 429
        const r = await politeFetch(thumb);
        if (!r.ok) {
          console.log(`  [skip] ${id}: HTTP ${r.status}`);
          continue;
        }
        const ext = extOf(thumb);
        const buf = Buffer.from(await r.arrayBuffer());
        const file = path.join("images", `${id}${ext}`);
        await writeFile(path.join(HERE, file), buf);
        added.push({
          id,
          file,
          partType: "door",
          side: "pending",
          view: "car",
          sourceUrl: info.descriptionurl ?? "",
          license: info.extmetadata?.LicenseShortName?.value ?? "see source",
          title: title.replace(/^File:/, ""),
        });
        console.log(`  [ok]   ${id}  ${title}`);
      } catch (e) {
        console.log(`  [err]  ${id}: ${(e as Error).message}`);
      }
    }
  }

  const all = existing.concat(added);
  await writeFile(MANIFEST, JSON.stringify(all, null, 2));

  // Contact sheet: only the still-pending rows need labeling.
  const pending = all.filter((r) => r.side === "pending");
  const cards = pending
    .map(
      (r) => `<figure>
  <img src="${r.file}" loading="lazy" />
  <figcaption><b>${r.id}</b> — <a href="${r.sourceUrl}" target="_blank">source</a><br/>
  <small>${r.title}</small><br/><small>${r.license}</small></figcaption>
</figure>`
    )
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>CaroSpecs eval — label sides</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;margin:24px}
h1{font-size:18px}p{color:#94a3b8;max-width:720px;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:16px}
figure{margin:0;background:#1b2336;border:1px solid #334155;border-radius:12px;padding:8px}
img{width:100%;height:200px;object-fit:cover;border-radius:8px;background:#272f42}
figcaption{font-size:12px;margin-top:6px;color:#cbd5e1}a{color:#60a5fa}</style>
<h1>Label the visible side — ${pending.length} new photos</h1>
<p>LEFT = driver side, RIGHT = passenger side. Reply with lines like
<code>wiki-046=LH, wiki-047=RH, wiki-048=skip</code>. Skip head-on shots with no single visible flank.</p>
<div class="grid">
${cards}
</div>`;
  await writeFile(LABELHTML, html);

  console.log(
    `\nAdded ${added.length} new (total ${all.length}, ${pending.length} pending). Open: open eval/label.html`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
