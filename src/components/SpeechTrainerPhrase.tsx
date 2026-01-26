import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, DeviceEventEmitter } from "react-native";

import SpeechCompare from "./SpeechCompare";
import { speakAndListen } from "../speechOrchestrator";
import { NativeModules } from "react-native";
import { waitTtsFinish } from "../tts";

const { RnJavaConnector } = NativeModules;

/**
 * Trainer phrases list (temporary hardcoded)
 */
const PHRASES = [
  "hello world this is speech trainer ai",
  "react native is working perfectly",
  "vosk recognition and tts are connected",
];

export default function SpeechTrainerPhrase() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState<"speaking" | "listening">("speaking");

  // 🔥 важный флаг: стартуем только после готовности TTS
  const [ttsInitialized, setTtsInitialized] = useState(false);

  const currentPhrase = PHRASES[phraseIndex];

  // ============================================================
  // 1) Wait for TtsReady event (first launch only)
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
  // 2) Start one training step (only when TTS ready)
  // ============================================================
  useEffect(() => {
    if (!ttsInitialized) return;

    let cancelled = false;

    async function runStep() {
      console.log("====================================");
      console.log("🔊 Trainer step started");
      console.log("Phrase:", currentPhrase);

      setPhase("speaking");

      // Speak phrase + auto start ASR after finish
      await speakAndListen(currentPhrase);

      if (cancelled) return;

      console.log("🎤 Listening...");
      setPhase("listening");
    }

    // 🔥 маленькая задержка, чтобы Android AudioFocus успел стабилизироваться
    setTimeout(() => {
      runStep();
    }, 300);

    return () => {
      cancelled = true;
    };
  }, [phraseIndex, ttsInitialized]);

  // ============================================================
  // 3) PhraseMatched listener → feedback + next phrase
  // ============================================================
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "PhraseMatched",
      async (evt) => {
        console.log("✅ Phrase complete:", evt.phrase);

        // 1) Stop recognition immediately
        await RnJavaConnector.stopRecognition();

        // 2) Speak feedback
        const id = await RnJavaConnector.speak("Correct!");
        await waitTtsFinish(id);

        // 3) Next phrase after delay
        setTimeout(() => {
          setPhraseIndex((prev) => {
            const next = prev + 1;

            if (next >= PHRASES.length) {
              console.log("🏁 Training finished!");
              return 0; // restart loop
            }

            return next;
          });
        }, 500);
      }
    );

    return () => sub.remove();
  }, []);

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.root}>
      <Text style={styles.header}>SpeechTrainer Loop</Text>

      <Text style={styles.title}>Current phrase:</Text>
      <Text style={styles.phrase}>{currentPhrase}</Text>

      {phase === "speaking" && (
        <Text style={styles.phase}>🔊 Озвучивание...</Text>
      )}

      {phase === "listening" && (
        <Text style={styles.phase}>🎤 Повторите фразу...</Text>
      )}

      {/* Compare UI */}
      <SpeechCompare inStr={currentPhrase} />
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
