import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AsrService } from "../speech/asr/AsrService";
import { AsrResultEvent } from "../speech/asr/types";

// -----------------------------
// Props
// -----------------------------
type Props = {
  /** Эталонный ответ */
  inStr: string;

  /** Callback: вся фраза совпала */
  onMatched: () => void;
};

// -----------------------------
// Helpers
// -----------------------------
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------
// Component
// -----------------------------
export default function SpeechCompare({ inStr, onMatched }: Props) {
  // ============================================================
  // 1) Эталонные слова
  // ============================================================
  const inStrWords = useMemo(() => {
    return normalizeText(inStr).split(" ").filter(Boolean);
  }, [inStr]);

  // Индекс текущего эталонного слова
  const currEtlWrdInd = useRef(0);

  // Флаг ожидания final после ошибки
  const waitFinal = useRef(false);

  // UI state
  const [asrResult, setAsrResult] = useState("");
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  // ============================================================
  // 2) Reset при смене эталона
  // ============================================================
  useEffect(() => {
    currEtlWrdInd.current = 0;
    waitFinal.current = false;

    setMatchedWords([]);
    setStatus("");
    setAsrResult("");
  }, [inStrWords.join(" ")]);

  // ============================================================
  // 3) Подписка на ASR результаты
  // ============================================================
  useEffect(() => {
    const unsubscribe = AsrService.subscribeResults(
      (evt: AsrResultEvent) => {
        setAsrResult(evt.text);

        const ASRWords = evt.text
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.toLowerCase());

        let firstMatchedWrdIndex = -1;

        // Если ждём final → игнорируем partial
        if (waitFinal.current && evt.type === "final") {
          waitFinal.current = false;
        } else if (waitFinal.current) {
          return;
        }

        // Сравнение слов
        for (let i = 0; i < ASRWords.length; i++) {
          const etlWord = inStrWords[currEtlWrdInd.current];
          const asrWord = ASRWords[i];

          if (!etlWord) break;

          const matched = etlWord === asrWord;

          // шум в начале
          if (!matched && firstMatchedWrdIndex === -1) {
            continue;
          }

          if (matched) {
            setMatchedWords((prev) => [...prev, etlWord]);

            if (firstMatchedWrdIndex === -1) {
              firstMatchedWrdIndex = i;
            }

            currEtlWrdInd.current++;

            // фраза полностью совпала
            if (currEtlWrdInd.current >= inStrWords.length) {
              setStatus("Ответ засчитан ✅");

              // 🔥 сообщаем наружу
              onMatched();
              return;
            }
          } else {
            // несовпадение → ждём финал
            waitFinal.current = true;
            break;
          }
        }
      }
    );

    return () => unsubscribe();
  }, [inStrWords, onMatched]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.box}>
      <Text style={styles.title}>ASR результат:</Text>
      <Text style={styles.etalon}>{asrResult}</Text>

      <Text style={styles.title}>Совпало:</Text>
      <Text style={styles.matched}>{matchedWords.join(" ")}</Text>

      {status.length > 0 && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

// -----------------------------
// Styles
// -----------------------------
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
