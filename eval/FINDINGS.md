# L/R Side Classification — Eval Findings

Phase 0 of `vision-model-improvement-plan.md`. Built a frozen, human-labeled
golden set + a harness that measures per-side accuracy, then measured the
current pipeline. **Key result: auto left/right is not viable; the fix is the
capture-time driver/passenger toggle + confidence gating (both shipped).**

## What we measured

| Run | Set | Overall | LH | RH | Notes |
|-----|-----|---------|----|----|-------|
| 1 | 23 imgs | 65.2% | 69% | 60% | tiny, noisy |
| 2 | 23 imgs (rerun) | 52.2% | — | — | same images, ±13pt swing from temp 0.2 |
| 3 | 67 imgs (RH-skewed) | 35.8% | 58.8% | 28.0% | skew inflates/deflates overall |
| 4 | **106 imgs balanced (53/53)** | **40.6%** | **50.9%** | **29.2%** | the trustworthy number |

## Why it fails (diagnosis from the per-case trace)

1. **Frame-of-reference gap.** Automotive L/R is egocentric (driver's seat
   facing forward); the model sees the car allocentrically (camera frame). The
   two are mirror-flipped for front-facing shots, and VLMs don't do the 3D
   rotation reliably.
2. **The decomposition didn't dodge it.** We had the model report raw
   observations (`vehicleFront`, per-part `imageSide`) and computed the side in
   code. But those observations are noise: `imageSide=left` mapped to truth
   **5 LH / 6 RH** (zero signal), and `vehicleFront` barely tracked reality.
3. **Strong Left bias.** Balanced run predicted **46 "Left" vs 17 "Right"** among
   committed answers — great on LH (90% when committed), terrible on RH (42%).
4. **Not self-consistent.** 65%→52% across identical runs (temp 0.2) = guessing
   at the margin, not reasoning.

It is **not** a geometry bug — fully inverting the mapping is also 50%.

## What shipped (the fix)

- **Capture-time toggle** (`app/app/review.tsx`): lister sets Driver/Passenger;
  locks the correct side onto every detected part. ~40% → ~100% when used.
- **Confidence gating**: side is stripped by default (parts listed sideless, e.g.
  "Front Door") with a nudge to set it. We never bake in a guess a human didn't
  confirm. "Use AI guess" is an opt-in, clearly labeled unreliable.
- Per-part **Swap L/R** for mixed-angle exceptions.

## How to actually improve auto accuracy (if revisited)

Ordered by ROI. Labels help ONLY via #1 and #3 — they do not train a frozen model.

1. **Few-shot exemplars** — embed 3–6 balanced labeled images with reasoning in
   the prompt. Works now, measurable against this set. Plan's "biggest lever."
2. **Model swap** — A/B a model with stronger spatial reasoning (e.g. Gemini 3
   Pro) using this harness. Cheap; may move the ceiling more than prompting.
3. **Fine-tuning (Phase 3)** — actually trains on labels, but needs 500–1,000+
   balanced examples (we have ~106). Last resort.
4. **Production feedback loop** — log every human Swap-L/R correction as
   training fuel toward #3.

## How to run

```bash
node eval/fetch-commons.ts            # grow the set (appends; you label by hand)
open eval/label.html                  # label sides by eye (or serve over http)
node eval/run.ts                      # full set
EVAL_MANIFEST=eval/golden/balanced.json node eval/run.ts   # balanced subset
```
Requires the web dev server on :3000. Never self-label sides — only the human/source.
