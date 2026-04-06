import { MSS, SpItem } from "../db/speechDb";
import { minItemInterval } from "./buildResultUpdate";

export function getInterval(item: SpItem, isReverse: boolean) {
  return isReverse ? item.intr ?? 0 : item.intf ?? 0;
}

function getTs(item: SpItem, isReverse: boolean) {
  return isReverse ? item.tsr ?? 0 : item.tsf ?? 0;
}

export function getCnt(item: SpItem, isReverse: boolean) {
  return isReverse ? item.cntr ?? 0 : item.cntf ?? 0;
}

function getCorrect(item: SpItem, isReverse: boolean) {
  return isReverse ? item.correctr ?? 0 : item.correctf ?? 0;
}

export function getStreak(item: SpItem, isReverse: boolean) {
  return isReverse ? item.streakr ?? 0 : item.streakf ?? 0;
}

function isOverdue(item: SpItem, isReverse: boolean, now: number) {
  if (getCnt(item, isReverse) === 0) return false;
  if (getTs(item, isReverse) === 0) return false;
  return now >= getTs(item, isReverse) + getInterval(item, isReverse);
}

function isFresh(item: SpItem, isReverse: boolean) {
  return getInterval(item, isReverse) <= minItemInterval;
}

function isSoon(item: SpItem, isReverse: boolean, now: number, limit: number) {
  const interval = getInterval(item, isReverse);
  if (interval <= minItemInterval) return false;

  const next = getTs(item, isReverse) + interval;
  return next > now && next <= limit;
}

function compareByMssAndTs(a: SpItem, b: SpItem, isReverse: boolean) {
  const mssDiff = MSS(a, isReverse) - MSS(b, isReverse);
  if (mssDiff !== 0) return mssDiff;

  return getTs(a, isReverse) - getTs(b, isReverse);
}

export function clamp(value: number, minValue: number, maxValue: number) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

function getDayStartTs(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getSoonRangeTs(ts: number, dayCount: number = 1): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayCount);
  return date.getTime();
}

export type TItemType = "overdue" | "fresh" | "other";

export type TaskDisplayItem = Pick<SpItem, "uid" | "a"> & {
  mss: number;
  itmType: TItemType;
};

export type LearnTask = {
  name: string;
  selectedTopics: string[];
  plannedDayItemCount: number;
  maxFreshItemCount:number;
  itemUids: string[];
}

export function getItemType(item: SpItem, isReverse: boolean, now: number): TItemType {
  if (isOverdue(item, isReverse, now)) return "overdue";
  if (isFresh(item, isReverse)) return "fresh";
  return "other";
}

export function convertToTaskDisplayItem(item: SpItem, isReverse: boolean, now: number): TaskDisplayItem {
  const result = { ...item, mss: Math.round((MSS(item, isReverse)*100))/100, itmType: getItemType(item, isReverse, now) };
  return result;
}


export function CreateTask(
  items: SpItem[],
  plannedDayItemCount: number,
  maxFreshItemCount: number,
  isReverse = false,
): SpItem[] {
  const now = Date.now();

  const overdue = items
    .filter((item) => isOverdue(item, isReverse, now));

  const fresh = items
    .filter((item) => isFresh(item, isReverse))
    .sort((a, b) => compareByMssAndTs(a, b, isReverse))
    .slice(0, Math.max(0, maxFreshItemCount));

  const other = items
    .filter((item) => getItemType(item, isReverse, now) === "other")
    .filter(item => getCorrect(item, isReverse) > 0);

  const cmpTypes = (a: SpItem, b: SpItem) => {
    const typePriority = {
      overdue: 0,
      fresh: 1,
      other: 2,
    };
    const typeA = getItemType(a, isReverse, now);
    const typeB = getItemType(b, isReverse, now);
    const priorityDiff = typePriority[typeA] - typePriority[typeB];
    return priorityDiff;
  };

  const result = [...overdue, ...fresh, ...other]
    .filter((item, index, array) =>
      array.findIndex((candidate) => candidate.uid === item.uid) === index
    )
    .sort((a, b) => {
      const typeDiff = cmpTypes(a, b);
      if (typeDiff !== 0) return typeDiff;
      const mssA = MSS(a, isReverse);
      const mssB = MSS(b, isReverse);
      const mssDiff = mssA - mssB;
      if (mssDiff !== 0) return mssDiff;
      const ats = getTs(a, isReverse);
      const bts = getTs(b, isReverse);
      return ats - bts;
    });

  return result
    .slice(0, Math.max(0, plannedDayItemCount));    
}

function wasShownToday(item: SpItem, isReverse: boolean, now: number) {
  if (getCnt(item, isReverse) === 0) return false;

  const ts = getTs(item, isReverse);
  if (ts === 0) return false;

  const dayStart = getDayStartTs(now);
  const nextDayStart = getSoonRangeTs(now);
  return ts >= dayStart && ts < nextDayStart;
}

export function getNextItemUid(
  allItems: SpItem[],
  isReverse = false,
  currentItemUid: string = "",
  maxNewItemCount: number = 15,
): string {
  const items = allItems;
  const plannedDayItemCount = maxNewItemCount;
  const now = Date.now();

  const overdue = items.filter((item) =>
    item.uid !== currentItemUid &&
    isOverdue(item, isReverse, now)
  );

  if (overdue.length > 0) {
    overdue.sort((a, b) => {
      const mssDiff = MSS(a, isReverse) - MSS(b, isReverse);
      if (mssDiff !== 0) return mssDiff;

      const intervalDiff = getInterval(a, isReverse) - getInterval(b, isReverse);
      if (intervalDiff !== 0) return intervalDiff;

      return getTs(a, isReverse) - getTs(b, isReverse);
    });

    console.log(`*** Overdue:${overdue[0].uid} Now:${now}`);
    return overdue[0].uid;
  }

  const fresh = items.filter((item) =>
    item.uid !== currentItemUid &&
    getInterval(item, isReverse) <= minItemInterval
  );

  if (fresh.length > 0) {
    fresh.sort((a, b) => {
      let sort = getCorrect(a, isReverse) - getCorrect(b, isReverse);
      if (sort !== 0) return sort;

      sort = getStreak(a, isReverse) - getStreak(b, isReverse);
      if (sort !== 0) return sort;

      sort = getCnt(a, isReverse) - getCnt(b, isReverse);
      if (sort !== 0) return sort;

      return getTs(a, isReverse) - getTs(b, isReverse);
    });

    const repeatedFresh = fresh.filter((item) =>
      getTs(item, isReverse) > 0 &&
      now - getTs(item, isReverse) > minItemInterval
    );
    if (repeatedFresh.length > 0) {
      console.log(`*** Fresh repeated:${repeatedFresh[0].uid}`);
      return repeatedFresh[0].uid;
    }

    const todayShownItemsCount = items.filter((item) =>
      wasShownToday(item, isReverse, now)
    ).length;

    if (todayShownItemsCount < plannedDayItemCount) {
      const unseenTodayFresh = fresh.filter((item) =>
        !wasShownToday(item, isReverse, now)
      );
      if (unseenTodayFresh.length > 0) {
        const index = Math.floor(Math.random() * unseenTodayFresh.length);
        console.log(`*** Fresh:${unseenTodayFresh[index].uid}`);
        return unseenTodayFresh[index].uid;
      }
    }
  }

  const soonLimit = getSoonRangeTs(now);
  const soon = items.filter((item) =>
    item.uid !== currentItemUid &&
    isSoon(item, isReverse, now, soonLimit)
  );

  if (soon.length > 0) {
    soon.sort((a, b) => compareByMssAndTs(a, b, isReverse));
    console.log(`*** Soon:${soon[0].uid}`);
    return soon[0].uid;
  }

  console.log(`*** Complete: no overdue or soon items. prev:${currentItemUid}`);
  return "";
}
