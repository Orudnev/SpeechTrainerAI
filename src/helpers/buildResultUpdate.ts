import { normalizeText } from "../components/SpeechCompare";
import { MSS, SpItem, SpItemResult } from "../db/speechDb";

type ResultUpdate = {
  patch: Partial<SpItem>;
  resultToPersist: SpItemResult;
};

function CalcInterval(item: SpItem,reverseMode:boolean,isError:boolean){
  const mss = MSS(item,reverseMode);
  const dayInMs = 86400000;
  const baseInterval = 1000 * 60 * 5; //5 minutes 
  let days = 0;
  if(isError){
    return baseInterval; // -F4 Сбросить интервал
  }
  if(mss > 90) days = 90
  else if(mss > 80) days = 21;
  else if(mss > 70) days = 7;
  else if(mss > 50) days = 3;
  else if(mss > 40) days = 1;
  const result = days * dayInMs; // -E7- Рассчитать новый интервал
  return result;  
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
    }
    : {
      cntf: nextCount,
      df: nextDurationAvg,
      dwf: nextWordAvg,
      tsf: now,
      correctf: nextCorrectCount,
      streakf: nextStreak,        
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
    },
  };
}