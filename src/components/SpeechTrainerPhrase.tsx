import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  useWindowDimensions,
  Image
} from "react-native";

import SpeechCompare from "./SpeechCompare";
import { speakAndListen } from "../speech/flow/speechOrchestrator";
import { TtsService } from "../speech/tts/TtsService";
import { AsrService } from "../speech/asr/AsrService";
import { AsrResultEvent } from "../speech/asr/types";

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
  Tvariant,
  toReverse,
  saveVariantsToPhrase,
  saveResultToPhrase,
  SpItemResult,
} from "../db/speechDb";

import { AnchoredOverlay } from "./AnchoredOverlay";
import { VariantPicker } from "./VariantPicker";
import Toolbar from "./Toolbar";
import { pickNextPhraseIndex } from "./phraseSelection";
import { Appbar } from "react-native-paper";
import { AppContext } from "../../App";

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
export type VariantStat = {
  text: string;
  count: number;
};



type ResultUpdate = {
  patch: Partial<SpItem>;
  resultToPersist: SpItemResult;
};

function buildResultUpdate(
  rawItem: SpItem,
  currentAnswer: string,
  listeningStartedAt: number | null,
  reverseMode: boolean
): ResultUpdate {
  const now = Date.now();
  const durationMs = listeningStartedAt
    ? Math.max(0, now - listeningStartedAt)
    : 0;

  const answerWordCount = Math.max(
    1,
    normalizeText(currentAnswer).split(" ").filter(Boolean).length
  );
  const durationPerWord = durationMs / answerWordCount;

  const prevCount = reverseMode ? rawItem.cntr ?? 0 : rawItem.cntf ?? 0;
  const nextCount = prevCount + 1;

  const prevDurationAvg = reverseMode ? rawItem.dr ?? 0 : rawItem.df ?? 0;
  const prevWordAvg = reverseMode ? rawItem.dwr ?? 0 : rawItem.dwf ?? 0;

  const nextDurationAvg =
    nextCount === 1
      ? durationMs
      : (prevDurationAvg * prevCount + durationMs) / nextCount;

  const nextWordAvg =
    nextCount === 1
      ? durationPerWord
      : (prevWordAvg * prevCount + durationPerWord) / nextCount;

  const patch: Partial<SpItem> = reverseMode
    ? {
        cntr: nextCount,
        dr: nextDurationAvg,
        dwr: nextWordAvg,
        tsr: now,
      }
    : {
        cntf: nextCount,
        df: nextDurationAvg,
        dwf: nextWordAvg,
        tsf: now,
      };

  return {
    patch,
    resultToPersist: {
      cntf: patch.cntf ?? rawItem.cntf ?? 0,
      cntr: patch.cntr ?? rawItem.cntr ?? 0,
      df: patch.df ?? rawItem.df ?? 0,
      dr: patch.dr ?? rawItem.dr ?? 0,
      dwf: patch.dwf ?? rawItem.dwf ?? 0,
      dwr: patch.dwr ?? rawItem.dwr ?? 0,
      tsf: patch.tsf ?? rawItem.tsf ?? 0,
      tsr: patch.tsr ?? rawItem.tsr ?? 0,
    },
  };
}

export default function SpeechTrainerPhrase() {
  const screenSize = useWindowDimensions();
  const ctx = useContext(AppContext);
  
  // ============================================================
  // Core trainer state
  // ============================================================
  const [items, setItems] = useState<SpItem[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState<"speaking" | "listening">("speaking");
  const [ttsInitialized, setTtsInitialized] = useState(false);
  const [reverseMode] = useState(false);
        // ============================================================
        // ASR integration (SINGLE SOURCE)
        // ============================================================
  const [lastAsrResult, setLastAsrResult] = useState<AsrResultEvent | null>(null);
  const [variantBuffer, setVariantBuffer] = useState<Map<string, VariantStat>>(new Map());
        // ============================================================
        // Current word (reported by SpeechCompare)
        // ============================================================
  const [currentWord, setCurrentWord] = useState("");
  const [listeningStartedAt, setListeningStartedAt] = useState<number | null>(null);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);

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
  const perAnswerVariants: Tvariant[] = rawItem?.variants ?? [];

  // ============================================================
  // Load DB
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
  // TTS ready
  // ============================================================
  useEffect(() => {
    const sub = TtsService.waitReady().then(() => {
      console.log("✅ TTS Ready");
      setTtsInitialized(true);
    });

    return () => {
      // no-op
    };
  }, []);

  // ============================================================
  // ASR subscription (THE ONLY ONE)
  // ============================================================
  useEffect(() => {
    return AsrService.subscribeResults((evt) => {
      setLastAsrResult(evt);

      // Collect partials into variant buffer
      if (evt.type === "partial" && phase === "listening") {
        const norm = normalizeText(evt.text);
        if (!norm) return;

        setVariantBuffer((prev) => {
          const next = new Map(prev);
          const v = next.get(norm);

          next.set(norm, {
            text: norm,
            count: v ? v.count + 1 : 1,
          });

          return next;
        });
      }
    });
  }, [phase]);
  
  // ============================================================
  // Reset variant buffer on new phrase
  // ============================================================
  useEffect(() => {
    setVariantBuffer(new Map());
    setLastAsrResult(null);
  }, [phraseIndex]);

  // ============================================================
  // Trainer loop
  // ============================================================
  useEffect(() => {
    if (!ttsInitialized) return;
    if (!hasData) return;

    let cancelled = false;

    async function runStep() {
      setPhase("speaking");
      await speakAndListen(currentQuestion, "vosk-en");
      if (cancelled) return;
      setListeningStartedAt(Date.now());
      setPhase("listening");
    }

    setTimeout(runStep, 300);
    return () => {
      cancelled = true;
    };
  }, [phraseIndex, ttsInitialized, hasData, currentQuestion]);

  // ============================================================
  // Variant UI helpers
  // ============================================================
  const savedVariantsForCurrentWord: string[] = useMemo(() => {
    if (!currentWord) return [];

    const entry = perAnswerVariants.find(
      (v) => v.word === currentWord
    );

    return entry?.variants ?? [];
  }, [perAnswerVariants, currentWord]);


  // ============================================================
  // Phrase matched callback
  // ============================================================
  async function handleMatched() {
    if (!rawItem) return;

    const { patch, resultToPersist } = buildResultUpdate(
      rawItem,
      currentAnswer,
      listeningStartedAt,
      reverseMode
    );

    await saveResultToPhrase(rawItem.uid, resultToPersist);

    const updatedItems = items.map((it) =>
      it.uid === rawItem.uid
        ? { ...it, ...patch }
        : it
    );

    setItems(updatedItems);

    console.log("✅ Phrase complete!");
    const id = await TtsService.speak("Correct!");
    await TtsService.waitFinish(id);

    const historyLimit = Math.max(3, Math.min(8, Math.floor(updatedItems.length / 2)));
    const nextHistory = [...recentHistory, rawItem.uid].slice(-historyLimit);
    const nextIndex = pickNextPhraseIndex(
      updatedItems,
      rawItem.uid,
      reverseMode,
      nextHistory
    );

    setRecentHistory(nextHistory);
    setListeningStartedAt(null);
    setPhraseIndex(nextIndex);
  }

  async function handleSaveVariants(selected: string[]) {
    if (!rawItem || !currentWord) return;

    const prev = rawItem.variants ?? [];
    let updated: Tvariant[];

    const existing = prev.find((v) => v.word === currentWord);

    if (existing) {
      updated = prev.map((v) =>
        v.word === currentWord
          ? {
            ...v,
            variants: Array.from(
              new Set([...v.variants, ...selected])
            ),
          }
          : v
      );
    } else {
      updated = [
        ...prev,
        { word: currentWord, variants: selected },
      ];
    }

    // 1️⃣ DB
    await saveVariantsToPhrase(rawItem.uid, updated);

    // 2️⃣ React state (немедленно)
    setItems((prevItems) =>
      prevItems.map((it) =>
        it.uid === rawItem.uid
          ? { ...it, variants: updated }
          : it
      )
    );
  }

  const variantStatsFromASR: VariantStat[] = useMemo(() => {
    return Array.from(variantBuffer.values())
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count);
  }, [variantBuffer]);

  const showVariantButton =
    savedVariantsForCurrentWord.length > 0 ||
    variantStatsFromASR.length > 0;

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={[styles.root,{width:screenSize.width}]}>
      {!hasData && <Text>Loading phrases...</Text>}

      {hasData && (
        <>
          <Toolbar>
            <AnchoredOverlay 
              anchor={({ onPress }) => (
                <Appbar.Action
                  icon="list-status"
                  onPress={onPress}
                />
              )}
            >
              {({ close }) => (
                <VariantPicker
                  variantsFromDatabase={savedVariantsForCurrentWord}
                  variantsFromASR={variantStatsFromASR}
                  onCancel={close}
                  onSave={(selected) => {
                    handleSaveVariants(selected);
                    close();
                  }}
                />
              )}
            </AnchoredOverlay>
            <Appbar.Action
              icon="cog-outline"
              onPress={() => {ctx?.setCurrPage("settings")}}
            />
          </Toolbar>
          <View style={styles.content}>
            {/* Trainer UI */}
            <Text style={styles.title}>Current question:</Text>
            <Text style={styles.phrase}>{currentQuestion}</Text>

            {/* <Text style={styles.currentWord}>
              Current word: {currentWord}
            </Text> */}

            {phase === "speaking" && (
              <Text style={styles.phase}>
                🔊 Озвучивание...
              </Text>
            )}

            {phase === "listening" && (
              <Text style={styles.phase}>
                🎤 Повторите фразу...
              </Text>
            )}

            {/* Compare */}
            <SpeechCompare
              etalon={currentAnswer}
              asrText={lastAsrResult?.text ?? null}
              variants={perAnswerVariants}
              onMatched={handleMatched}
              onCurrentWord={setCurrentWord}
            />

            {/* Debug helper */}
            <Button
              title="Simulate correct word"
              onPress={() => {
                if (!currentWord) return;
                setLastAsrResult({
                  engine: "vosk-en",
                  type: "final",
                  text: currentWord,
                });
              }}
            />
          </View>
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
    flex: 1,
  },
  content: {
    paddingLeft: 20,
  },

  title: {
    fontWeight: "700",
    marginTop: 10,
  },
  phrase: {
    fontSize: 16,
    marginBottom: 8,
  },
  currentWord: {
    marginTop: 10,
    fontWeight: "800",
    fontSize: 16,
  },
  phase: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: "600",
  },
});
