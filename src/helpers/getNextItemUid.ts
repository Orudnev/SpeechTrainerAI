import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import { normalizeText } from "../components/SpeechCompare";
import { MSS, SpItem, SpItemResult } from "../db/speechDb";
import { minItemInterval } from "./buildResultUpdate";

const DAY = 86400000;

// helpers

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
  if (getCnt(item, isReverse) == 0) return false; // -C- Новые элементы не просрочены
  return now >= getTs(item, isReverse) + getInterval(item, isReverse);
}

function isSoon(item: SpItem, isReverse: boolean, now: number, limit: number) {
  const interval = getInterval(item, isReverse);
  if (interval <= minItemInterval) return false; // Новые элементы и элементы с минимальным интервалом не должны попадать в категорию "soon"
  const next = getTs(item, isReverse) + interval;
  return next > now && next <= limit;
}

function isTodayItem(item: SpItem, isReverse: boolean, now: number) {
  if (isOverdue(item, isReverse, now)) {
    return true;
  }
  return isSoon(item, isReverse, now, getNextDayStartTs(now));
}


function randNoise() {
  return Math.random() * 0.01;
}

// -----------------------------------------------------
export function clamp(value: number, minValue: number, maxValue: number) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

export function getNextDayStartTs(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}




export function getNextItemUid(allItems: SpItem[], isReverse = false, currentItemUid: string, maxNewItemCount: number = 20): string {
  const items = allItems;
  const PlannedDayItemCount = 50; // дневная норма (если осталось меньше чем DayItemCountLimit, то добавляются новые элементы)
  const now = Date.now();

  // Build overdue list
  const overdue = items.filter(itm =>
    itm.uid !== currentItemUid &&
    isOverdue(itm, isReverse, now)
  );

  if (overdue.length > 0) {
    // -F- Select weakest
    overdue.sort((a, b) => {
      if (a.uid == currentItemUid) return 1; // a - текущий элемент, сдвинуть его вниз списка 
      if (b.uid == currentItemUid) return -1; // b - текущий элемент, сдвинуть его вниз списка
      const m = MSS(a, isReverse) - MSS(b, isReverse);
      if (m !== 0) return m;

      const i =
        getInterval(a, isReverse) -
        getInterval(b, isReverse);
      if (i !== 0) return i;

      return randNoise();
    });
    console.log(`*** Overdue:${overdue[0].uid}`);
    return overdue[0].uid;
  }

  const todayItemsCount = items.filter(itm => isTodayItem(itm, isReverse, now)).length;
  if (todayItemsCount < PlannedDayItemCount) {
    // Количество элементов на сегодня меншьше плана, добавляем новый элемент
    let fresh = items.filter(itm =>
      itm.uid !== currentItemUid &&
      getInterval(itm, isReverse) <= minItemInterval
    );
    if (fresh.length > 0) {
      fresh.sort((a: SpItem, b: SpItem) => {
        let s = getCorrect(a, isReverse) - getCorrect(b, isReverse);
        if (s !== 0) return s;
        s = getStreak(a, isReverse) - getStreak(b, isReverse);
        if (s !== 0) return s;
        s = getCnt(a, isReverse) - getCnt(b, isReverse)
        if (s !== 0) return s;
        s = getTs(a, isReverse) - getTs(b, isReverse);
        return s;
      });
      if (fresh.some(itm => Date.now() - getTs(itm, isReverse) > minItemInterval)) {

        console.log(`*** Fresh repeated:${fresh[0].uid}`);
        return fresh[0].uid;
      } else {
        const r = Math.random();
        const ind = Math.floor(r * fresh.length);
        console.log(`*** Fresh:${fresh[ind].uid}`);
        return fresh[ind].uid;
      }
    }
  } else {
    // Build soon list
    const soonLimit = getNextDayStartTs(now);
    const soon = items.filter(itm =>
      itm.uid !== currentItemUid &&
      isSoon(itm, isReverse, now, soonLimit)
    );

    if (soon.length > 0) {

      soon.sort((a, b) =>
        MSS(a, isReverse) - MSS(b, isReverse)
      );
      console.log(`*** Soon:${soon[0].uid}`);
      return soon[0].uid; // -Z-
    }
  }
  //Maintenance
  const maintenance = items.filter(itm =>
    MSS(itm, isReverse) > 80
  );

  if (maintenance.length > 0) {

    //Random maintenance
    const index = Math.floor(
      Math.random() * maintenance.length
    );
    console.log(`*** Maintenance:${maintenance[index].uid}`);
    return maintenance[index].uid; // -Z-
  }
  // Fallback
  const fallBackItems = items.filter(itm => itm.uid !== currentItemUid);
  const index = Math.floor(Math.random() * fallBackItems.length);
  console.log(`*** Fallback:${items[index].uid} prev:${currentItemUid}`);
  if (fallBackItems[index].uid == currentItemUid) {
    console.warn(`Selected current item ${currentItemUid} in fallback, this should be avoided if possible`);
  }
  return fallBackItems[index].uid; // -Z-
}



