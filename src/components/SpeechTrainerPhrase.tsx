import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  DeviceEventEmitter,
  Button,
  Pressable,
} from "react-native";

import SpeechCompare from "./SpeechCompare";
import { speakAndListen } from "../speech/flow/speechOrchestrator";
import { TtsService } from "../speech/tts/TtsService";
import { NativeModules } from "react-native";

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
  toReverse,
  saveVariantsToPhrase,
} from "../db/speechDb";

import { AsrService } from "../speech/asr/AsrService";


/**
 * Normalize ASR text
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Variant statistics
 */
type VariantStat = {
  text: string;
  count: number;
};

export default function SpeechTrainerPhrase() {
  // ============================================================
  // State
  // ============================================================
  const [items, setItems] = useState<SpItem[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const [phase, setPhase] = useState<"speaking" | "listening">("speaking");
  const [ttsInitialized, setTtsInitialized] = useState(false);

  // Reverse mode toggle
  const [reverseMode, setReverseMode] = useState(false);

  // Variant UI
  const [showVariants, setShowVariants] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Variant buffer
  const variantBuffer = useRef<Map<string, VariantStat>>(new Map());

  // ============================================================
  // Load DB phrases
  // ============================================================
  useEffect(() => {
    async function load() {
      console.log("📦 Loading phrases from SQLite...");

      await initSpeechDb();
      await seedSpeechDbIfEmpty();

      const data = await loadAllPhrases();
      setItems(data);
    }

    load();
  }, []);

  // ============================================================
  // Wait for TTS ready
  // ============================================================
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("TtsReady", () => {
      console.log("✅ TTS Ready");
      setTtsInitialized(true);
      sub.remove();
    });

    return () => sub.remove();
  }, []);

  // ============================================================
  // Current phrase
  // ============================================================
  const hasData = items.length > 0;
  const rawItem = hasData ? items[phraseIndex] : null;

  const currentItem = useMemo(() => {
    if (!rawItem) return null;
    return reverseMode ? toReverse(rawItem) : rawItem;
  }, [rawItem, reverseMode]);

  const currentQuestion = currentItem?.q ?? "";
  const currentAnswer = currentItem?.a ?? "";
  const currentUid = rawItem?.uid ?? "";

  // Parse per-answer variants JSON
  const perAnswerVariants: string[] = useMemo(() => {
    return rawItem?.variants ?? [];
  }, [rawItem]);

  // ============================================================
  // Collect ASR variants while listening
  // ============================================================
  useEffect(() => {
    if (!hasData) return;

    const sub = DeviceEventEmitter.addListener("SpeechResult", (msg: string) => {
      try {
        const evt = JSON.parse(msg);

        if (evt.type !== "partial") return;
        if (phase !== "listening") return;

        const norm = normalizeText(evt.text);
        if (!norm) return;

        const buf = variantBuffer.current;
        const existing = buf.get(norm);

        if (existing) existing.count++;
        else buf.set(norm, { text: norm, count: 1 });
      } catch { }
    });

    return () => sub.remove();
  }, [phase, hasData]);

  // ============================================================
  // Trainer loop
  // ============================================================
  useEffect(() => {
    if (!ttsInitialized) return;
    if (!hasData) return;

    let cancelled = false;

    async function runStep() {
      variantBuffer.current.clear();
      setSelected(new Set());

      setPhase("speaking");

      await speakAndListen(currentQuestion,"vosk-en");

      if (cancelled) return;

      setPhase("listening");
    }

    setTimeout(runStep, 300);

    return () => {
      cancelled = true;
    };
  }, [phraseIndex, ttsInitialized, hasData, currentQuestion]);

  // ============================================================
  // PhraseMatched callback
  // ============================================================
  async function handleMatched() {
    console.log("✅ Phrase complete!");

    await AsrService.stopSession();

    const id = await TtsService.speak("Correct!");
    await TtsService.waitFinish(id);

    setPhraseIndex((prev) => (prev + 1) % items.length);
  }

  // ============================================================
  // Variant list for UI
  // ============================================================
  const variants: VariantStat[] = useMemo(() => {
    return [...variantBuffer.current.values()]
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count);
  }, [showVariants]);

  // ============================================================
  // Toggle selection
  // ============================================================
  function toggleVariant(text: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  // ============================================================
  // Save selected variants
  // ============================================================
  async function handleSaveVariants() {
    if (!rawItem) return;

    const arr = Array.from(selected);
    console.log("💾 Saving variants:", arr);

    await saveVariantsToPhrase(rawItem.uid, arr);

    setShowVariants(false);
    setSelected(new Set());
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.root}>
      <Text style={styles.header}>SpeechTrainer Loop</Text>

      {!hasData && <Text>Loading phrases...</Text>}

      {hasData && (
        <>
          <Text style={styles.title}>Current question:</Text>
          <Text style={styles.phrase}>{currentQuestion}</Text>

          <Text style={styles.title}>Expected answer:</Text>
          <Text style={styles.answer}>{currentAnswer}</Text>

          <Text style={styles.mode}>
            Mode: {reverseMode ? "Reverse" : "Forward"}
          </Text>

          <Button
            title="Toggle Reverse Mode"
            onPress={() => setReverseMode((p) => !p)}
          />

          {phase === "speaking" && (
            <Text style={styles.phase}>🔊 Озвучивание...</Text>
          )}

          {phase === "listening" && (
            <Text style={styles.phase}>🎤 Повторите фразу...</Text>
          )}

          {/* SpeechCompare */}
          <SpeechCompare
            inStr={currentAnswer}
            itemUid={currentUid}
            variants={perAnswerVariants}
            onMatched={handleMatched}
          />

          <Button title="Show Variants" onPress={() => setShowVariants(true)} />

          {/* Variant picker */}
          {showVariants && (
            <View style={styles.variantBox}>
              <Text style={styles.variantTitle}>
                ASR варианты (повторяющиеся):
              </Text>

              {variants.length === 0 && (
                <Text style={{ marginTop: 8 }}>
                  Нет повторяющихся вариантов
                </Text>
              )}

              {variants.map((v) => {
                const checked = selected.has(v.text);

                return (
                  <Pressable
                    key={v.text}
                    style={styles.variantRow}
                    onPress={() => toggleVariant(v.text)}
                  >
                    <Text style={{ fontSize: 16 }}>
                      {checked ? "✅" : "⬜"} {v.text} ({v.count})
                    </Text>
                  </Pressable>
                );
              })}

              <View style={styles.variantButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setShowVariants(false)}
                />

                <Button
                  title="Save"
                  onPress={handleSaveVariants}
                  disabled={selected.size === 0}
                />
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  root: {
    padding: 20,
    width: "95%",
    borderWidth: 2,
    borderRadius: 16,
    marginTop: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  title: {
    fontWeight: "700",
    marginTop: 8,
  },
  phrase: {
    fontSize: 16,
    marginBottom: 8,
  },
  answer: {
    fontSize: 15,
    fontStyle: "italic",
    marginBottom: 8,
  },
  phase: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: "600",
  },
  mode: {
    marginTop: 10,
    fontWeight: "700",
  },
  variantBox: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  variantTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  variantRow: {
    paddingVertical: 6,
  },
  variantButtons: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
