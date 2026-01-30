import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  DeviceEventEmitter,
  Button,
  Pressable,
  ScrollView,
} from "react-native";

import SpeechCompare from "./SpeechCompare";
import { speakAndListen } from "../speech/flow/speechOrchestrator";
import { TtsService } from "../speech/tts/TtsService";

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
  Tvariant,
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
 * Variant statistics (UI only)
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

  // Current active etalon word (from SpeechCompare)
  const [currentWord, setCurrentWord] = useState("");

  // Variant buffer (partial ASR collector)
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

  // Per-answer variants теперь Tvariant[]
  const perAnswerVariants: Tvariant[] = useMemo(() => {
    return rawItem?.variants ?? [];
  }, [rawItem]);


  // ============================================================
  // Saved variants for currentWord (from DB)
  // ============================================================
  const savedVariantsForWord: string[] = useMemo(() => {
    if (!currentWord) return [];

    const entry = perAnswerVariants.find(
      (v) => v.word === currentWord
    );

    return entry?.variants ?? [];
  }, [perAnswerVariants, currentWord]);

  // ============================================================
  // When opening Variant Picker → preselect saved variants
  // ============================================================
  useEffect(() => {
    if (!showVariants) return;

    // auto-select saved variants
    setSelected(new Set(savedVariantsForWord));
  }, [showVariants, savedVariantsForWord]);


  // ============================================================
  // Collect ASR partial variants while listening
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

      await speakAndListen(currentQuestion, "vosk-en");

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
  // Save selected variants for currentWord
  // ============================================================
  async function handleSaveVariants() {
    if (!rawItem) return;
    if (!currentWord) return;

    const arr = Array.from(selected);

    console.log("💾 Saving variants for word:", currentWord, arr);

    const prevVariants: Tvariant[] = rawItem.variants ?? [];

    let updated: Tvariant[];

    const existing = prevVariants.find((v) => v.word === currentWord);

    if (existing) {
      updated = prevVariants.map((v) =>
        v.word === currentWord
          ? {
            ...v,
            variants: Array.from(new Set([...v.variants, ...arr])),
          }
          : v
      );
    } else {
      updated = [
        ...prevVariants,
        {
          word: currentWord,
          variants: arr,
        },
      ];
    }

    // Save into DB
    await saveVariantsToPhrase(rawItem.uid, updated);

    // Update React state immediately
    setItems((prev) =>
      prev.map((it) =>
        it.uid === rawItem.uid ? { ...it, variants: updated } : it
      )
    );

    setShowVariants(false);
    setSelected(new Set());
  }

  // ============================================================
  // Combined variant list for UI
  // ============================================================
  const combinedVariantList: VariantStat[] = useMemo(() => {
    const map = new Map<string, VariantStat>();

    // 1) from ASR buffer
    for (const v of variants) {
      map.set(v.text, v);
    }

    // 2) from saved variants (force include)
    for (const sv of savedVariantsForWord) {
      if (!map.has(sv)) {
        map.set(sv, { text: sv, count: 999 });
        // count=999 just to show it's saved
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [variants, savedVariantsForWord]);


  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.root}>
      <Text style={styles.header}>SpeechTrainer Loop</Text>

      {!hasData && <Text>Loading phrases...</Text>}

      {hasData && (
        <>
          <Button title="Reload" onPress={() => AsrService.reloadCurrentEngine()} />
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

          <Text style={styles.currentWord}>
            Current word: {currentWord}
          </Text>

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
            onCurrentWord={(w) => setCurrentWord(w)}
          />

          <Button title="Show Variants" onPress={() => setShowVariants(true)} />

          {/* Variant picker */}
          {showVariants && (
            <View style={styles.variantBox}>
              <Text style={styles.variantTitle}>
                ASR варианты (повторяющиеся):
              </Text>

              {/* ✅ ScrollView всегда существует */}
              <ScrollView style={styles.variantScroll}>
                {variants.length === 0 && (
                  <Text style={{ marginTop: 8 }}>
                    Нет повторяющихся вариантов
                  </Text>
                )}
                {combinedVariantList.map((v) => {
                  const checked = selected.has(v.text);

                  const isSaved = savedVariantsForWord.includes(v.text);

                  return (
                    <Pressable
                      key={v.text}
                      style={[
                        styles.variantRow,
                        checked && styles.variantRowSelected,
                      ]}
                      onPress={() => toggleVariant(v.text)}
                    >
                      <Text style={styles.variantText}>
                        {checked ? "✅" : "⬜"} {v.text}

                        {isSaved && " ⭐"}

                        {!isSaved && ` (${v.count})`}
                      </Text>
                    </Pressable>
                  );
                })}


              </ScrollView>

              {/* ✅ кнопки всегда внизу */}
              <View style={styles.variantButtons}>
                <Button title="Cancel" onPress={() => setShowVariants(false)} />

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
  currentWord: {
    marginTop: 10,
    fontWeight: "800",
    fontSize: 16,
  },

  // Variant picker styles
  variantBox: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    // ✅ фиксированная высота окна
    height: 300,
  },
  variantTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  variantScroll: {
    marginTop: 10,
    flex: 1, // ✅ занимает всё свободное место
  },
  variantRow: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  variantRowSelected: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  variantText: {
    fontSize: 16,
  },
  variantButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});
