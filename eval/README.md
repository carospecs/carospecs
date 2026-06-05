# Vision Eval Harness — Phase 0 (L/R side referee)

Implements **Phase 0** of `vision-model-improvement-plan.md`: a frozen, labeled
golden set + a runner that prints a confusion matrix and **per-side accuracy** so
we can measure L/R classification before changing anything else.

## The one rule that keeps this honest

**We never label side ourselves.** Self-labeling would reproduce the model's own
bias and poison the referee. Every image's `side` must come from its **source**
— an auto-parts listing whose title explicitly states the side
(`LH`/`Left`/`Driver` or `RH`/`Right`/`Passenger`) — and every entry records a
`sourceUrl` so labels are auditable. Spot-check a sample by hand.

Vocabulary: store `LH` / `RH` (the country-independent industry convention =
driver's seated frame). Avoid storing "driver/passenger" (flips for RHD markets).

## Files

- `seed.json` — input list of `{ id, url, side, partType, view, condition, sourceUrl }`.
  `url` = direct image URL; `side` = the SOURCE's stated side.
- `collect.ts` — downloads each `url` into `images/`, writes `golden/manifest.json`.
- `golden/manifest.json` — the frozen referee set (downloaded files + labels).
- `run.ts` — runs the real `/api/identify` over the set; prints confusion matrix,
  per-side accuracy, L→R / R→L counts, undetermined count, and every mismatch.

## Usage

```bash
# 1. Put labeled image URLs in seed.json (side taken from the listing title)
# 2. Download them:
node eval/collect.ts
# 3. With the web dev server running on :3000:
node eval/run.ts
#    (or:  API_BASE=http://localhost:3000 node eval/run.ts)
```

## What the numbers mean here

This pipeline does **not** ask the model for the side. The model returns raw
observations (`vehicleFront` + per-part `imageSide`) and the API computes the
side with fixed geometry. So expect:

- **Full-car shots** (front/rear/side): geometry can resolve the side → scored LH/RH.
- **Isolated part-on-pallet shots**: no vehicle context → `vehicleFront: unknown`
  → the pipeline **declines** to assign a side (counted as **UNDET**, not wrong).

UNDET is a *safe* outcome (better than a confident wrong guess), but a high UNDET
rate on isolated parts tells us where to invest next (e.g. a capture-time
driver/passenger toggle, per Phase 4).

## Stratification target (per the plan)

150–300 images, ~40% front-of-car, plus rear/side/isolated, **50/50 LH/RH**, with
hard cases (dirty, low light, partial). Keep the set frozen once built.
