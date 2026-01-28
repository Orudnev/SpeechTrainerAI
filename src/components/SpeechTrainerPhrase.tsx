import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, DeviceEventEmitter } from "react-native";

import SpeechCompare from "./SpeechCompare";
import { speakAndListen } from "../speechOrchestrator";
import { NativeModules } from "react-native";
import { waitTtsFinish } from "../tts";

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
} from "../db/speechDb";

const { RnJavaConnector } = NativeModules;

export default function SpeechTrainerPhrase() {
  // ============================================================
  // State
  // ============================================================
  const [items, setItems] = useState<SpItem[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const [phase, setPhase] = useState<"speaking" | "listening">("speaking");

  // Trainer starts only after TTS ready
  const [ttsInitialized, setTtsInitialized] = useState(false);

  // ============================================================
  // 0) Init DB + Load phrases
  // ============================================================
  useEffect(() => {
    console.log("🗄️ Initializing SQLite DB...");

    async function load() {
      try {
        await initSpeechDb();
        await seedSpeechDbIfEmpty();

        const data = await loadAllPhrases();
        console.log("✅ Loaded phrases:", data.length);

        setItems(data);
      } catch (err) {
        console.error("DB load error:", err);
      }
    }

    load();
  }, []);

  // ============================================================
  // 1) Wait for TTS Ready
  // ============================================================
  useEffect(() => {
    console.log("⏳ Waiting for TTS initialization...");

    const sub = DeviceEventEmitter.addListener("TtsReady", () => {
      console.log("✅ TTS Ready received → Trainer can start");
      setTtsInitialized(true);
      sub.remove();
    });

    return () => sub.remove();
  }, []);

  // ============================================================
  // Current item (safe)
  // ============================================================
  const hasData = items.length > 0;
  const currentItem = hasData ? items[phraseIndex] : null;

  const currentQuestion = currentItem?.q ?? "";
  const currentAnswer = currentItem?.a ?? "";

  // ============================================================
  // 2) Training step loop
  // ============================================================
  useEffect(() => {
    if (!ttsInitialized) return;
    if (!hasData) return;

    let cancelled = false;

    async function runStep() {
      console.log("====================================");
      console.log("🔊 Trainer step started");
      console.log("Question:", currentQuestion);
      console.log("Expected answer:", currentAnswer);

      setPhase("speaking");

      // Speak QUESTION, then ASR starts automatically
      await speakAndListen(currentQuestion,"vosk-en");

      if (cancelled) return;

      console.log("🎤 Listening...");
      setPhase("listening");
    }

    // Small delay for Android AudioFocus stabilization
    setTimeout(runStep, 300);

    return () => {
      cancelled = true;
    };
  }, [phraseIndex, ttsInitialized, hasData]);

  // ============================================================
  // 3) PhraseMatched → feedback + next phrase
  // ============================================================
  useEffect(() => {
    if (!hasData) return;

    const sub = DeviceEventEmitter.addListener("PhraseMatched", async () => {
      console.log("✅ Phrase matched!");

      // Stop recognition immediately
      await RnJavaConnector.stopRecognition("vosk-en");

      // Speak feedback
      const id = await RnJavaConnector.speak("Correct!"); 
      await waitTtsFinish(id);

      // Next phrase
      setTimeout(() => {
        setPhraseIndex((prev) => {
          const next = (prev + 1) % items.length;
          return next;
        });
      }, 500);
    });

    return () => sub.remove();
  }, [hasData, items.length]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.root}>
      <Text style={styles.header}>SpeechTrainer Loop (SQLite)</Text>

      {/* Loading state */}
      {!hasData && <Text>Loading phrases from database...</Text>}

      {/* Main trainer UI */}
      {hasData && (
        <>
          <Text style={styles.title}>Current question:</Text>
          <Text style={styles.phrase}>{currentQuestion}</Text>

          {phase === "speaking" && (
            <Text style={styles.phase}>🔊 Озвучивание...</Text>
          )}

          {phase === "listening" && (
            <Text style={styles.phase}>🎤 Повторите фразу...</Text>
          )}

          {/* Compare ASR with expected ANSWER */}
          <SpeechCompare inStr={currentAnswer} />
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
    marginTop: 6,
  },
  phrase: {
    fontSize: 16,
    marginBottom: 10,
  },
  phase: {
    fontSize: 16,
    marginBottom: 14,
    fontWeight: "600",
  },
});
