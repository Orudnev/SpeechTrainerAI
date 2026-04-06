import {initSpeechDb, openSpeechDb} from './speechDb';
import { TDiagramPeriodName } from '../helpers/statistics';
import { LearnTask } from '../helpers/getNextItemUid';

export type TSettingName =
  | 'fullAccess'
  | 'asrModelType'
  | 'openAiApiKey'
  | 'reverseMode'
  | 'rowsCloudDataSource'
  | 'selectedTopics'
  | 'groupingPeriod' 
  | 'groupingScope' // phrase|current topic|all selected topics  grouping for statistics diagram
  | 'taskList'
  | 'selectedTask'
export type TServiceCommandName = 'downloadRowsFromCloud' | 'uploadRowsToCloud';


export type TsettingsItem = {
  name: TSettingName;
  value?: any;
  defaultValue: any;
  needAdvancedRights?: boolean;
};

export const AppSettings: TsettingsItem[] = [
  {
    name: 'fullAccess',
    defaultValue: false,
  },
  {
    name: 'asrModelType',
    defaultValue: 'vosk',
  },
  {
    name: 'openAiApiKey',
    defaultValue: '',
  },
  {
    name: 'reverseMode',
    defaultValue: false,
  },
  {
    name: 'selectedTopics',
    defaultValue: [],
  },
  {
    name: 'rowsCloudDataSource',
    defaultValue: '',
    needAdvancedRights: true,
  },
  {
    name:'groupingPeriod',
    defaultValue: '1 minute',
    needAdvancedRights: false
  },
  {
    name:'groupingScope',
    defaultValue: 'Phrase',
    needAdvancedRights: false
  },
  {
    name: 'taskList',
    defaultValue: [{ name: 'Default Task', itemUids: [] }] as LearnTask [],
  },
  {
    name: 'selectedTask',
    defaultValue: 'Default Task',
  }
];

function getAppSettingOrFail(name: TSettingName): TsettingsItem {
  const found = AppSettings.find(setting => setting.name === name);
  if (!found) {
    throw new Error(`Unknown setting: ${name}`);
  }

  return found;
}

function isLearnTask(value: any): value is LearnTask {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    Array.isArray(value.itemUids) &&
    value.itemUids.every((uid: unknown) => typeof uid === 'string'),
  );
}

function normalizeTaskList(value: any, defaultValue: LearnTask[]): LearnTask[] {
  if (!Array.isArray(value)) {
    return defaultValue;
  }

  const normalized = value.filter(isLearnTask).map(task => ({
    name: task.name,
    itemUids: [...task.itemUids],
  }));

  return normalized.length > 0
    ? normalized
    : defaultValue.map(task => ({ ...task, itemUids: [...task.itemUids] }));
}

function normalizeSelectedTask(value: any, taskList: LearnTask[], defaultValue: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue;
  }

  return taskList.some(task => task.name === value) ? value : defaultValue;
}

function applySettingsFromObject(payload: Record<string, any>) {
  const defaultTaskList = getAppSettingOrFail('taskList').defaultValue as LearnTask[];
  const taskList = normalizeTaskList(payload.taskList, defaultTaskList);

  for (const item of AppSettings) {
    if (item.name === 'taskList') {
      item.value = taskList;
      continue;
    }

    if (item.name === 'selectedTask') {
      item.value = normalizeSelectedTask(
        payload.selectedTask,
        taskList,
        item.defaultValue,
      );
      continue;
    }

    item.value = payload[item.name] ?? item.defaultValue;
  }
}

function normalizeSettingValueByDefaultValue(
  value: any,
  defaultValue: any,
): any {
  if (value == null) {
    return defaultValue;
  }

  if (Array.isArray(defaultValue)) {
    return Array.isArray(value) ? value : defaultValue;
  }

  const defaultType = typeof defaultValue;
  if (
    defaultType === 'boolean' ||
    defaultType === 'string' ||
    defaultType === 'number'
  ) {
    return typeof value === defaultType ? value : defaultValue;
  }

  return value;
}

export function getAppSettingValue<T = any>(name: TSettingName): T {  
  const setting = getAppSettingOrFail(name);
  const result = normalizeSettingValueByDefaultValue(
    setting.value,
    setting.defaultValue,
  ) as T;
  return result;
}

export function setAppSettingValue(name: TSettingName, value: any) {
  const setting = getAppSettingOrFail(name);
  setting.value = value;
}

function buildSettingsObjectFromMemory(): Record<TSettingName, any> {
  const nextPayload = {} as Record<TSettingName, any>;
  const taskListSetting = getAppSettingOrFail('taskList');
  const normalizedTaskList = normalizeTaskList(
    taskListSetting.value,
    taskListSetting.defaultValue as LearnTask[],
  );

  for (const item of AppSettings) {
    if (item.name === 'taskList') {
      nextPayload[item.name] = normalizedTaskList;
      continue;
    }

    if (item.name === 'selectedTask') {
      nextPayload[item.name] = normalizeSelectedTask(
        item.value,
        normalizedTaskList,
        item.defaultValue,
      );
      continue;
    }

    nextPayload[item.name] = item.value ?? item.defaultValue;
  }

  return nextPayload;
}

export async function loadAppSettingsFromDb() {
  await initSpeechDb();
  const db = await openSpeechDb();

  const res = await db.executeSql(
    `SELECT settings FROM appSettings ORDER BY rowid DESC LIMIT 1;`,
  );

  if (res[0].rows.length === 0) {
    applySettingsFromObject({});
    return;
  }

  let parsed: Record<string, any> = {};
  const row = res[0].rows.item(0);

  if (row?.settings) {
    try {
      parsed = JSON.parse(row.settings);
    } catch (e) {
      parsed = {};
    }
  }
  applySettingsFromObject(parsed);
}

export async function saveAppSettingsToDb() {
  await initSpeechDb();
  const db = await openSpeechDb();

  const payload = buildSettingsObjectFromMemory();
  await db.executeSql(`DELETE FROM appSettings;`);
  await db.executeSql(`INSERT INTO appSettings(settings) VALUES(?);`, [
    JSON.stringify(payload),
  ]);
}
