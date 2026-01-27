import React, { useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter, StyleSheet, Text, View } from "react-native";

// -----------------------------
// Types
// -----------------------------
export type SpeechEvent = {
  type: "partial" | "final";
  text: string;
};

type Props = {
  /** Эталонный ответ */
  inStr: string;
};

// -----------------------------
// Component
// -----------------------------
/**
 * SpeechCompare
 * Сравнивает речь пользователя (ASR) с эталонной фразой.
 * Алгоритм реализован строго по описанию в задаче.
 */
export default function SpeechCompare({ inStr }: Props) {
  // 3.1 Инициализация
  const inStrWords = useMemo(
    () =>
      inStr
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    [inStr]
  );

  // Индекс текущего эталонного слова
  const currEtlWrdInd = useRef(0);

  // Флаг ожидания final после ошибки
  const waitFinal = useRef(false);

  // UI: текущие результаты распознавания ASR
  const [asrResult, setAsrResult] = useState("");

  // UI: какие слова уже совпали
  const [matchedWords, setMatchedWords] = useState<string[]>([]);

  // UI: сообщение
  const [status, setStatus] = useState<string>("");

  // Сброс при новом эталоне
  useEffect(() => {
    currEtlWrdInd.current = 0;
    waitFinal.current = false;
    setMatchedWords([]);
    setStatus("");
  }, [inStrWords.join(" ")]);

  // 3.2 Обработка SpeechResult
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "SpeechResult",
      (msg: string) => {
        const evt = JSON.parse(msg) as SpeechEvent;
        setAsrResult(evt.text);
        // 3.2.1 Разбиваем ASR текст на слова
        const ASRWords = evt.text
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.toLowerCase());

        // 3.2.2
        let firstMatchedWrdIndex = -1;

        // 3.2.3 Если ждём final — игнорируем partial
        if (waitFinal.current && evt.type === "final") {
          // 3.2.6
          waitFinal.current = false;
        } else if (waitFinal.current) {
          return;
        }

        // 3.2.4 Цикл обработки ASRWords
        for (let currAsrWrdInd = 0; currAsrWrdInd < ASRWords.length; currAsrWrdInd++) {
          const etlWord = inStrWords[currEtlWrdInd.current]?.toLowerCase();
          const asrWord = ASRWords[currAsrWrdInd].toLowerCase();

          // если эталон уже закончился
          if (!etlWord) break;

          // 3.2.4.1 сравнение
          const isCurrWrdMatched = etlWord === asrWord;

          // 3.2.4.2 шум в начале
          if (!isCurrWrdMatched && firstMatchedWrdIndex === -1) {
            continue;
          }

          // 3.2.4.3 слово совпало?
          if (isCurrWrdMatched) {
            // 3.2.4.3.1 отображаем совпавшее слово
            setMatchedWords((prev) => {
              const next = [...prev];
              next.push(inStrWords[currEtlWrdInd.current]);
              return next;
            });

            // 3.2.4.3.2 первое совпадение
            if (firstMatchedWrdIndex === -1) {
              firstMatchedWrdIndex = currAsrWrdInd;
            }

            // 3.2.4.3.3 следующее слово эталона
            currEtlWrdInd.current++;

            // 3.2.4.3.4 конец полной сессии?
            if (currEtlWrdInd.current >= inStrWords.length) {
              break; // 3.2.5
            }
          } else {
            // 3.2.4.3.5 слово не совпало → конец частичной сессии
            waitFinal.current = true;
            break; // 3.2.5
          }
        }

        // 3.2.7 Проверка полной сессии
        if (currEtlWrdInd.current >= inStrWords.length) {
          // 3.2.8
          setStatus("Ответ засчитан");
          DeviceEventEmitter.emit("PhraseMatched", {
            phrase: inStrWords.join(" "),
          });          
        }
      }
    );

    return () => sub.remove();
  }, [inStrWords]);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Ответ:</Text>
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
