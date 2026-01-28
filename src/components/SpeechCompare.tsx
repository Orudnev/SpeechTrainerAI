import React, { useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter, StyleSheet, Text, View } from "react-native";

/**
 * SpeechResult event type
 */
export type SpeechEvent = {
  type: "partial" | "final";
  text: string;
};

type Props = {
  /** Эталонный ответ */
  inStr: string;

  /** UID текущей фразы */
  itemUid: string;

  /** Per-answer допустимые ASR варианты */
  variants: string[];

  /** Callback при успешном совпадении */
  onMatched: () => void;
};

/**
 * Normalize text:
 * - lowercase
 * - remove punctuation
 * - collapse spaces
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try merge two ASR words:
 * scale + ability → scalability
 */
function tryMergeWords(words: string[], index: number): string | null {
  if (index + 1 >= words.length) return null;
  return words[index] + words[index + 1];
}

/**
 * SpeechCompare
 * Compares user ASR output against expected phrase.
 */
export default function SpeechCompare({
  inStr,
  itemUid,
  variants,
  onMatched,
}: Props) {
  // ============================================================
  // Prepare эталонные слова
  // ============================================================
  const inStrWords = useMemo(() => {
    const normalized = normalizeText(inStr);
    return normalized.split(" ").filter(Boolean);
  }, [inStr]);

  // Current эталонный индекс
  const currEtlWrdInd = useRef(0);

  // Wait for final after mismatch
  const waitFinal = useRef(false);

  // UI state
  const [asrResult, setAsrResult] = useState("");
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  // ============================================================
  // Reset on new phrase
  // ============================================================
  useEffect(() => {
    currEtlWrdInd.current = 0;
    waitFinal.current = false;
    setMatchedWords([]);
    setStatus("");
  }, [itemUid]);

  // ============================================================
  // Helper: check per-answer variants
  // ============================================================
  function isVariantMatch(asrText: string): boolean {
    const norm = normalizeText(asrText);

    for (const v of variants) {
      if (normalizeText(v) === norm) {
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // SpeechResult listener
  // ============================================================
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "SpeechResult",
      (msg: string) => {
        const evt = JSON.parse(msg) as SpeechEvent;

        setAsrResult(evt.text);

        // --------------------------------------------------------
        // 1) Если ASR совпал с per-answer variant целиком
        // --------------------------------------------------------
        if (evt.type === "final" && isVariantMatch(evt.text)) {
          setStatus("Ответ засчитан (variant)");
          onMatched();
          return;
        }

        // --------------------------------------------------------
        // 2) Tokenize ASR words
        // --------------------------------------------------------
        const ASRWords = normalizeText(evt.text)
          .split(" ")
          .filter(Boolean);

        // Ignore empty
        if (ASRWords.length === 0) return;

        // --------------------------------------------------------
        // 3) WaitFinal logic
        // --------------------------------------------------------
        if (waitFinal.current && evt.type === "final") {
          waitFinal.current = false;
        } else if (waitFinal.current) {
          return;
        }

        // --------------------------------------------------------
        // 4) Main matching loop (supports merge)
        // --------------------------------------------------------

        let currAsrWrdInd = 0;
        let startedMatching = false;

        while (currAsrWrdInd < ASRWords.length) {
          const etlWord = inStrWords[currEtlWrdInd.current];
          if (!etlWord) break;

          const asrWord = ASRWords[currAsrWrdInd];

          let matched = false;

          // Exact match
          if (etlWord === asrWord) {
            matched = true;
            currAsrWrdInd += 1;
          } else {
            // Merge match
            const merged = tryMergeWords(ASRWords, currAsrWrdInd);
            if (merged && merged === etlWord) {
              matched = true;
              currAsrWrdInd += 2;
            }
          }

          // --------------------------------------------------------
          // ✅ Noise skipping BEFORE first match
          // --------------------------------------------------------
          if (!matched && !startedMatching) {
            currAsrWrdInd += 1;
            continue; // пропускаем шум
          }

          // --------------------------------------------------------
          // ❌ Mismatch AFTER matching started → wait final
          // --------------------------------------------------------
          if (!matched) {
            waitFinal.current = true;
            break;
          }

          // --------------------------------------------------------
          // ✅ Word matched
          // --------------------------------------------------------
          startedMatching = true;

          setMatchedWords((prev) => [...prev, etlWord]);
          currEtlWrdInd.current++;

          if (currEtlWrdInd.current >= inStrWords.length) {
            break;
          }
        }

        // --------------------------------------------------------
        // 5) Full phrase matched
        // --------------------------------------------------------
        if (currEtlWrdInd.current >= inStrWords.length) {
          setStatus("Ответ засчитан");
          onMatched();
        }
      }
    );

    return () => sub.remove();
  }, [inStrWords, variants]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.box}>
      <Text style={styles.title}>ASR:</Text>
      <Text style={styles.etalon}>{asrResult}</Text>

      <Text style={styles.title}>Matched:</Text>
      <Text style={styles.matched}>{matchedWords.join(" ")}</Text>

      {status.length > 0 && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  box: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    margin: 10,
  },
  title: {
    fontWeight: "600",
    marginTop: 6,
  },
  etalon: {
    fontSize: 16,
  },
  matched: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  status: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
  },
});
