import { AppSettings, getAppSettingValue, setAppSettingValue } from "../db/settings";
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

export type TaskDisplayItem = Pick<SpItem, "uid" | "a"  > & {
  mss: number;
  itmType: TItemType;
  scheduledTime:Date;
};

export type LearnTask = {
  name: string;
  selectedTopics: string[];
  plannedDayItemCount: number;
  maxFreshItemCount: number;
  itemUids: string[];
  indf: number;
  indr: number;
}

export function GetLearnTaskUid(task:LearnTask,isReverse:boolean):string{
  const idx = isReverse?task.indr:task.indf;
  const uid = task.itemUids[idx];
  return uid;
}

export function getItemType(item: SpItem, isReverse: boolean, now: number): TItemType {
  if (isOverdue(item, isReverse, now)) return "overdue";
  if (isFresh(item, isReverse)) return "fresh";
  return "other";
}

export function convertToTaskDisplayItem(item: SpItem, isReverse: boolean, now: number): TaskDisplayItem {
  const result = { ...item, mss: Math.round((MSS(item, isReverse) * 100)) / 100, itmType: getItemType(item, isReverse, now), scheduledTime: new Date(getTs(item, isReverse) + getInterval(item, isReverse)) };
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

export function getItemUid(
  itmKind: 'next'|'current'
): LearnTask {
  const isReverse = getAppSettingValue<boolean>('reverseMode');
  const taskList = getAppSettingValue<LearnTask[]>('taskList');
  const selectedTaskName = getAppSettingValue<string>('selectedTask')
  const selectedTaskData = taskList.find(t => t.name === selectedTaskName);
  if (!selectedTaskData) {
    throw Error(`Task ${selectedTaskName} not found`);
  }
  const indGet = () => isReverse ? selectedTaskData.indr : selectedTaskData.indf;
  const indSet = (newValue: number) => {
    if (isReverse) {
      selectedTaskData.indr = newValue;
    } else {
      selectedTaskData.indf = newValue;
    }
    setAppSettingValue('taskList',taskList);
  };

  if(itmKind == 'current'){
    return selectedTaskData;
  }

  if (indGet() + 1 < selectedTaskData.itemUids.length) {
    indSet(indGet() + 1);
  } else {
    indSet(0);
  }
  return selectedTaskData;
}
