import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import { normalizeText } from "../components/SpeechCompare";
import { MSS, SpItem, SpItemResult } from "../db/speechDb";
import { minItemInterval } from "./buildResultUpdate";

const DAY = 86400000;

// helpers

function getInterval(item: SpItem, isReverse:boolean) {
  return isReverse ? item.intr ?? 0 : item.intf ?? 0;
}

function getTs(item: SpItem, isReverse:boolean) {
  return isReverse ? item.tsr ?? 0 : item.tsf ?? 0;
}

function getCnt(item:SpItem, isReverse:boolean){
    return isReverse ? item.cntr ?? 0 : item.cntf ?? 0;
}

function isOverdue(item: SpItem, isReverse:boolean, now: number) {
  if(getCnt(item,isReverse) == 0) return false; // -C- Новые элементы не просрочены
  return now >= getTs(item, isReverse) + getInterval(item, isReverse);
}

function isSoon(item: SpItem, isReverse:boolean, now: number, limit: number) {
  const interval = getInterval(item, isReverse);
  if(interval == minItemInterval) return false; // Элементы с минимальным интервалом не должны попадать в категорию "soon"
  const next = getTs(item, isReverse) + interval;
  return next > now && next <= limit;
}


function randNoise() {
  return Math.random() * 0.01;
}

// -----------------------------------------------------

export function getNextItemUid(allItems: SpItem[],isReverse = false,currentItemUid:string): string {

  // -A- Start getNextItem

  // -B- Load all items
  const items = allItems;

  const now = Date.now();

  // -D- Build overdue list
  const overdue = items.filter(itm =>
    isOverdue(itm, isReverse, now)
  );

  // -E- Overdue exists?
  if (overdue.length > 0) {

    // -F- Select weakest
    overdue.sort((a, b) => {
      if(a.uid == currentItemUid) return 1; // a - текущий элемент, сдвинуть его вниз списка 
      if(b.uid == currentItemUid) return -1; // b - текущий элемент, сдвинуть его вниз списка
      const m = MSS(a,isReverse) - MSS(b, isReverse);
      if (m !== 0) return m;

      const i =
        getInterval(a, isReverse) -
        getInterval(b, isReverse);
      if (i !== 0) return i;

      return randNoise();
    });

    // -Z- Return item
    console.log(`*** Overdue:${overdue[0].uid}`);
    return overdue[0].uid;
  }

  // -H- Build soon list
  const soonLimit = now + 5 * DAY;

  const soon = items.filter(itm =>
    isSoon(itm, isReverse, now, soonLimit)
  );

  // -I- Soon exists?
  if (soon.length > 0) {

    // -J- Select weakest
    soon.sort((a, b) =>
      MSS(a, isReverse) - MSS(b, isReverse)
    );
    console.log(`*** Soon:${soon[0].uid}`);
    return soon[0].uid; // -Z-
  }

  // -L- Maintenance
  const maintenance = items.filter(itm =>
    MSS(itm, isReverse) > 80
  );

  // -M- Exists?
  if (maintenance.length > 0) {

    // -N- Random maintenance
    const index = Math.floor(
      Math.random() * maintenance.length
    );
    console.log(`*** Maintenance:${maintenance[index].uid}`);
    return maintenance[index].uid; // -Z-
  }

  // -O- New list
  const fresh = items.filter(itm =>
    getCnt(itm,isReverse) == 0
  );

  // -P- Exists?
  if (fresh.length > 0) {
    // -Q- Random new
    const r = Math.random();
    const ind = Math.floor(r * fresh.length);    
    console.log(`*** Fresh:${fresh[ind].uid}`);
    return fresh[ind].uid; // -Z-
  }

  // -R- Fallback
  const index = Math.floor(Math.random() * items.length);
  console.log(`*** Fallback:${items[index].uid}`);
  return items[index].uid; // -Z-
}



