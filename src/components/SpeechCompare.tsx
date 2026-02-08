import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { Tvariant } from "../db/speechDb";

/**
 * Normalize text
 */
function normalizeText(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Проверка по вариантам
 */
function checkVariants(
  etalonWord: string,
  variants: Tvariant[],
  casrr: string
): boolean {
  const entry = variants.find(
    (v) => normalizeText(v.word) === normalizeText(etalonWord)
  );

  if (!entry) return false;

  for (const tvElm of entry.variants) {
    if (normalizeText(casrr).includes(normalizeText(tvElm))) {
      return true;
    }
  }

  return false;
}

/**
 * Props
 */
type Props = {
  etalon: string;
  asrText: string | null;
  variants: Tvariant[];
  onMatched: () => void;
  onCurrentWord?: (word: string) => void;
};

export default function SpeechCompare({
  etalon,
  asrText,
  variants,
  onMatched,
  onCurrentWord,
}: Props) {
  const etalonWords = useMemo(() => {
    return normalizeText(etalon).split(" ").filter(Boolean);
  }, [etalon]);

  const currIndex = useRef(0);

  const [asrResult, setAsrResult] = useState("");
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  // ============================================================
  // Reset on new phrase
  // ============================================================
  useEffect(() => {
    currIndex.current = 0;
    setMatchedWords([]);
    setStatus("");

    // сообщаем первое слово
    if (etalonWords.length > 0 && onCurrentWord) {
      onCurrentWord(etalonWords[0]);
    }
  }, [etalon]);


  useEffect(() => {
    if (!asrText) return;
    setAsrResult(asrText);
    processCASRR(asrText);
  }, [asrText]);


  /**
   * Mark word matched
   */
  function markWordMatched(word: string) {
    setMatchedWords((prev) => [...prev, word]);
    currIndex.current++;

    // ✅ Фраза полностью завершена?
    if (currIndex.current >= etalonWords.length) {
      setStatus("Ответ засчитан");
      onMatched();
      return;
    }

    // сообщаем новое текущее слово
    const nextWord = etalonWords[currIndex.current];
    if (nextWord && onCurrentWord) {
      onCurrentWord(nextWord);
    }
  }


  /**
   * CASRR обработка
   */
  function processCASRR(casrr: string) {
    const CASRRWords = normalizeText(casrr)
      .split(" ")
      .filter(Boolean);

    let etalonWord = etalonWords[currIndex.current];
    if (!etalonWord) return;

    // ============================================================
    // 1) Шум: ничего нет
    // ============================================================
    if (CASRRWords.length === 0) {
      if (checkVariants(etalonWord, variants, casrr)) {
        markWordMatched(etalonWord);
      }
      return;
    }

    // ============================================================
    // 1.2 Ищем совпадение текущего эталонного слова
    // ============================================================
    const foundIndex = CASRRWords.findIndex((w) => w === etalonWord);

    if (foundIndex === -1) {
      // ============================================================
      // 2) Проверка по вариантам
      // ============================================================
      if (checkVariants(etalonWord, variants, casrr)) {
        markWordMatched(etalonWord);
      }
      return;
    }

    // ============================================================
    // 3) Сравнение следующих слов
    // ============================================================
    let i = foundIndex;

    while (i < CASRRWords.length) {
      etalonWord = etalonWords[currIndex.current];
      if (!etalonWord) break;

      const spoken = CASRRWords[i];

      if (spoken === etalonWord) {
        markWordMatched(etalonWord);
        i++;
        continue;
      }

      // ============================================================
      // 4) fallback: variants
      // ============================================================
      if (checkVariants(etalonWord, variants, casrr)) {
        markWordMatched(etalonWord);
      }

      break;
    }
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={styles.box}>
      <Button title="Simulate answer" onPress={() => {
        setAsrResult(etalonWords[currIndex.current]);
        processCASRR(etalonWords[currIndex.current]);
        //markWordMatched(etalonWords[currIndex.current]);
      }} />
      <Text style={styles.title}>CASRR:</Text>
      <Text style={styles.etalon}>{asrResult}</Text>

      <Text style={styles.title}>Matched:</Text>
      <Text style={styles.matched}>{matchedWords.join(" ")}</Text>

      {status.length > 0 && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

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
    width: 350,
    height: 40,
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
