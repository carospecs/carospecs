import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import type { AIPartOutput } from "@carospecs/shared";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import {
  PartReviewCard,
  draftFromAI,
  forceSide,
  stripSide,
  type PartDraft,
} from "@/components/ReviewCard";
import { getPendingCapture, clearPendingCapture } from "@/lib/captureStore";
import { identifyPart } from "@/lib/identify";
import { enqueueCapture } from "@/lib/queue";
import { useSession } from "@/lib/auth";
import { saveListings, parseFitment } from "@/lib/listings";

type State =
  | { phase: "loading" }
  | { phase: "ready"; ais: AIPartOutput[] }
  | { phase: "error"; message: string; canRetry: boolean };

export default function Review() {
  const router = useRouter();
  const { session, shop } = useSession();
  const pending = getPendingCapture();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [drafts, setDrafts] = useState<PartDraft[]>([]);
  const [vehicleSide, setVehicleSide] = useState<"LH" | "RH" | "ai" | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // The lister sets which side of the vehicle this photo shows; we then lock
  // that side onto every detected part (re-derived from the AI's original name
  // so toggling is reversible). The model's own L/R guess is unreliable, so this
  // is the accurate path. "Not sure" falls back to the AI guess.
  function applyVehicleSide(side: "LH" | "RH" | "ai" | null) {
    if (state.phase !== "ready") return;
    const ais = state.ais;
    setVehicleSide(side);
    setDrafts((prev) =>
      prev.map((d, i) => {
        const base = stripSide(ais[i].partName);
        const partName =
          side === "ai"
            ? ais[i].partName // opt into the AI's (unreliable) guess
            : side === "LH"
            ? forceSide(base, "Left")
            : side === "RH"
            ? forceSide(base, "Right")
            : base; // null → sideless (gated default)
        return { ...d, partName };
      })
    );
  }

  async function run() {
    if (!pending) {
      setState({ phase: "error", message: "No photo found.", canRetry: false });
      return;
    }
    setState({ phase: "loading" });
    const result = await identifyPart({ imageBase64: pending.imageBase64 });
    if (!result.ok) {
      setState({ phase: "error", message: result.userMessage, canRetry: true });
      return;
    }
    if (result.data.length === 0) {
      setState({
        phase: "error",
        message:
          "We couldn't spot any sellable parts in this photo. Try a clearer shot or a different angle.",
        canRetry: true,
      });
      return;
    }
    // Gate: drop the AI's unreliable L/R by default — parts start sideless until
    // the lister sets the vehicle side (or opts into the AI guess).
    setDrafts(
      result.data.map((d) => ({
        ...draftFromAI(d),
        partName: stripSide(d.partName),
      }))
    );
    setVehicleSide(null);
    setState({ phase: "ready", ais: result.data });
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchDraft(index: number, patch: Partial<PartDraft>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }

  async function queueForLater() {
    if (!pending) return;
    await enqueueCapture({ imageBase64: pending.imageBase64 });
    clearPendingCapture();
    Alert.alert(
      "Saved for later",
      "We'll process this photo automatically once you're back online."
    );
    router.back();
  }

  async function saveAll() {
    if (!pending || state.phase !== "ready") return;
    if (!session || !shop) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }
    const chosen = drafts
      .map((d, i) => ({ d, ai: state.ais[i] }))
      .filter(({ d }) => d.included);
    if (chosen.length === 0) {
      Alert.alert("Nothing selected", "Include at least one part to save.");
      return;
    }
    setSaving(true);
    try {
      await saveListings({
        shopId: shop.id,
        userId: session.user.id,
        imageBase64: pending.imageBase64,
        parts: chosen.map(({ d, ai }) => ({
          aiOutput: ai,
          corrected: {
            partName: d.partName,
            partCategory: d.partCategory,
            condition: d.condition,
            conditionNotes: d.conditionNotes,
            description: d.description,
            fitment: parseFitment(d.fitmentText),
            priceUsd: Number(d.price) || 0,
          },
        })),
      });
      clearPendingCapture();
      router.replace("/listings");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!pending) {
    return (
      <Centered>
        <Text style={styles.errText}>No photo found. Go back and try again.</Text>
      </Centered>
    );
  }

  const includedCount = drafts.filter((d) => d.included).length;

  return (
    <View style={styles.container}>
      <Image source={{ uri: pending.imageUri }} style={styles.photo} />

      {state.phase === "loading" && (
        <Centered>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Finding parts in your photo…</Text>
        </Centered>
      )}

      {state.phase === "error" && (
        <Centered>
          <View style={styles.errBox}>
            <TriangleAlert size={28} color={colors.signal} />
            <Text style={styles.errText}>{state.message}</Text>
            <View style={styles.errActions}>
              {state.canRetry && <Button label="Try again" onPress={run} />}
              <Button
                label="Save & finish later"
                variant="secondary"
                onPress={queueForLater}
              />
            </View>
          </View>
        </Centered>
      )}

      {state.phase === "ready" && (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.foundLabel}>
              {state.ais.length} part{state.ais.length === 1 ? "" : "s"} found —
              review, edit, and pick which to list.
            </Text>

            <View style={styles.sideBar}>
              <Text style={styles.sideTitle}>Which side of the vehicle?</Text>
              <View style={styles.sideRow}>
                {(
                  [
                    { k: "LH" as const, label: "Driver (L)" },
                    { k: "RH" as const, label: "Passenger (R)" },
                    { k: "ai" as const, label: "Use AI guess" },
                  ]
                ).map((opt) => {
                  const sel = vehicleSide === opt.k;
                  return (
                    <Pressable
                      key={String(opt.k)}
                      onPress={() => applyVehicleSide(opt.k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                      style={[styles.sideBtn, sel && styles.sideBtnSel]}
                    >
                      <Text
                        style={[styles.sideBtnText, sel && styles.sideBtnTextSel]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {vehicleSide === null ? (
                <View style={styles.sideNudge}>
                  <TriangleAlert size={14} color={colors.signal} />
                  <Text style={styles.sideNudgeText}>
                    Pick the side — the AI can&apos;t reliably tell left from
                    right, so parts are listed without a side until you set it.
                  </Text>
                </View>
              ) : (
                <Text style={styles.sideHint}>
                  {vehicleSide === "ai"
                    ? "Using the AI's left/right guess — it's often wrong, so double-check each part."
                    : `Locked to ${
                        vehicleSide === "LH" ? "driver (left)" : "passenger (right)"
                      } side for every part.`}
                </Text>
              )}
            </View>

            {drafts.map((d, i) => (
              <PartReviewCard
                key={i}
                ai={state.ais[i]}
                draft={d}
                onChange={(patch) => patchDraft(i, patch)}
              />
            ))}
            <Text style={styles.disclaimer}>
              AI can make mistakes. Double-check each part before you post.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={
                includedCount === 0
                  ? "Select parts to save"
                  : `Save ${includedCount} listing${
                      includedCount === 1 ? "" : "s"
                    }`
              }
              loading={saving}
              disabled={includedCount === 0}
              onPress={saveAll}
            />
          </View>
        </>
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photo: { width: "100%", height: 180, backgroundColor: colors.surface },
  scroll: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  foundLabel: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 20,
  },
  sideBar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  sideTitle: { color: colors.foreground, fontSize: font.body, fontWeight: "700" },
  sideRow: { flexDirection: "row", gap: space.sm },
  sideBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  sideBtnSel: { backgroundColor: colors.accent, borderColor: colors.accent },
  sideBtnText: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  sideBtnTextSel: { color: colors.white },
  sideHint: { color: colors.muted, fontSize: font.tiny, lineHeight: 18 },
  sideNudge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.signalBg,
    borderWidth: 1,
    borderColor: colors.signal,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  sideNudgeText: { color: colors.signal, fontSize: font.tiny, flex: 1, lineHeight: 18 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    gap: space.md,
  },
  loadingText: { color: colors.muted, fontSize: font.body },
  errBox: { alignItems: "center", gap: space.md, maxWidth: 320 },
  errText: {
    color: colors.foreground,
    fontSize: font.body,
    textAlign: "center",
    lineHeight: 24,
  },
  errActions: { gap: space.sm, alignSelf: "stretch", marginTop: space.sm },
  disclaimer: {
    color: colors.muted,
    fontSize: font.tiny,
    textAlign: "center",
    marginTop: space.sm,
  },
  footer: {
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.background,
  },
});
