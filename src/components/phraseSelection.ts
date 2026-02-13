import { SpItem } from "../db/speechDb";

const TARGET_WORD_DURATION_MS = 2500;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function getWeaknessScore(item: SpItem, reverseMode: boolean): number {
  const count = reverseMode ? item.cntr ?? 0 : item.cntf ?? 0;
  const avgWordDuration = reverseMode ? item.dwr ?? 0 : item.dwf ?? 0;
  const effectiveDuration =
    count === 0 ? TARGET_WORD_DURATION_MS : avgWordDuration;

  // Чем меньше count и чем больше задержка ответа, тем хуже изучено слово.
  const noveltyPart = 1 / (1 + count);
  const speedPart = clamp(effectiveDuration / TARGET_WORD_DURATION_MS);

  return noveltyPart * 0.7 + speedPart * 0.3;
}

function getRecencyFactor(uid: string, recentHistory: string[]): number {
  const index = recentHistory.lastIndexOf(uid);
  if (index === -1) return 1;

  const stepsAgo = recentHistory.length - index;

  if (stepsAgo <= 1) return 0.05;
  if (stepsAgo <= 2) return 0.2;
  if (stepsAgo <= 4) return 0.5;
  return 0.8;
}

export function pickNextPhraseIndex(
  allItems: SpItem[],
  currentUid: string,
  reverseMode: boolean,
  recentHistory: string[]
): number {
  if (allItems.length <= 1) return 0;

  const weighted = allItems.map((item, index) => {
    const weakness = getWeaknessScore(item, reverseMode);
    const recencyFactor = getRecencyFactor(item.uid, recentHistory);
    const sameAsCurrentFactor = item.uid === currentUid ? 0.01 : 1;

    return {
      index,
      weight: weakness * recencyFactor * sameAsCurrentFactor,
    };
  });

  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  if (total <= 0) {
    const fallback = weighted.find((x) => allItems[x.index].uid !== currentUid);
    return fallback?.index ?? 0;
  }

  let threshold = Math.random() * total;

  for (const candidate of weighted) {
    threshold -= candidate.weight;
    if (threshold <= 0) return candidate.index;
  }

  return weighted[weighted.length - 1].index;
}
