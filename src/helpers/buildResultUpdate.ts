import { normalizeText } from "../components/SpeechCompare";
import { MSS, SpItem, SpItemResult } from "../db/speechDb";
import { clamp, getCnt, getInterval, getStreak } from "./getNextItemUid";

type ResultUpdate = {
  patch: Partial<SpItem>;
  resultToPersist: SpItemResult;
};

export const minItemInterval = 60000 * 2; //2 минуты 

function CalcInterval(item: SpItem, reverseMode: boolean, isError: boolean) {
  const MIN = 60000;
  const HOUR = 3600000;
  const DAY = 86400000;

  const cnt = reverseMode ? item.cntr ?? 0 : item.cntf ?? 0;
  const prevInterval = reverseMode ? item.intr ?? 0 : item.intf ?? 0;
  const streak = reverseMode ? item.streakr ?? 0 : item.streakf ?? 0;
  const dw = reverseMode ? item.dwr ?? 800 : item.dwf ?? 800;
  function decay(interval: number): number {
    const days = interval / DAY;

    if (days < 30) return 1;       // быстрый рост
    if (days < 180) return 0.8;    // замедление
    if (days < 365) return 0.6;
    return 0.4;                    // почти плато
  }
  // -------------------------
  // LEARNING PHASE
  // -------------------------
  if (prevInterval < DAY) {
    const steps = [
      10 * MIN,
      1 * HOUR,
      1 * DAY
    ];

    if (isError) {
      // откат на предыдущий шаг
      return steps[Math.max(0, cnt - 1)];
    }

    return steps[cnt];
  }

  // -------------------------
  // REVIEW PHASE
  // -------------------------

  const MAX_INTERVAL = 1 * 365 * DAY;
  if (isError) {
    return 1 * DAY;
  }
  let growth = 1.7;
  // скорость
  const speedFactor = clamp(1 - dw / 1200, 0, 1);
  growth += speedFactor * 0.5;
  // серия
  growth += Math.min(streak / 20, 0.3);
  // ограничение роста
  growth = clamp(growth, 1.3, 2.5);
  // замедление роста
  const decayFactor = decay(prevInterval);
  let next = prevInterval * growth * decayFactor;
  // hard cap
  next = Math.min(next, MAX_INTERVAL);
  // защита от слишком малого роста
  return Math.round(Math.max(next, 1 * DAY));
}

export function buildResultUpdate(
  rawItem: SpItem,
  currentAnswer: string,
  listeningStartedAt: number | null,
  reverseMode: boolean,
  resetStreakOnError: boolean = false,
): ResultUpdate {
  const now = Date.now();
  const durationMs = listeningStartedAt
    ? Math.max(0, now - listeningStartedAt)
    : 0;

  const answerWordCount = Math.max(
    1,
    normalizeText(currentAnswer).split(' ').filter(Boolean).length,
  );
  // -B- Вычисление параметров
  const durationPerWord = durationMs / answerWordCount;

  const prevCount = reverseMode ? rawItem.cntr ?? 0 : rawItem.cntf ?? 0;
  const nextCount = prevCount + 1;

  const prevCorrectCount = reverseMode ? rawItem.correctr ?? 0 : rawItem.correctf ?? 0;
  const nextCorrectCount = prevCorrectCount + 1;

  const prevStreak = reverseMode ? rawItem.streakr ?? 0 : rawItem.streakf ?? 0;
  const nextStreak = resetStreakOnError
    ? Math.floor(prevStreak / 2) // -F2- Уменьшить streak
    : prevStreak + 1;            // -E4- Увеличить streak

  let interval = CalcInterval(rawItem, reverseMode, resetStreakOnError); // -E5- Вычислить новый интервал
  if (resetStreakOnError) {
    interval = minItemInterval; // -F3- Минимальный интервал 5 минут
  }

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
      correctr: nextCorrectCount,
      streakr: nextStreak,
      intr: interval,
    }
    : {
      cntf: nextCount,
      df: nextDurationAvg,
      dwf: nextWordAvg,
      tsf: now,
      correctf: nextCorrectCount,
      streakf: nextStreak,
      intf: interval,
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
      correctf: patch.correctf ?? rawItem.correctf ?? 0,
      correctr: patch.correctr ?? rawItem.correctr ?? 0,
      streakf: patch.streakf ?? rawItem.streakf ?? 0,
      streakr: patch.streakr ?? rawItem.streakr ?? 0,
      intf: patch.intf ?? rawItem.intf ?? 0,
      intr: patch.intr ?? rawItem.intr ?? 0,
    },
  };
}