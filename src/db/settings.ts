import {initSpeechDb, openSpeechDb} from './speechDb';
import { TDiagramPeriodName } from '../helpers/statistics';

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
    defaultValue: ['Default Task'] as string[],
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

function applySettingsFromObject(payload: Record<string, any>) {
  for (const item of AppSettings) {
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
  return normalizeSettingValueByDefaultValue(
    setting.value,
    setting.defaultValue,
  ) as T;
}

export function setAppSettingValue(name: TSettingName, value: any) {
  const setting = getAppSettingOrFail(name);
  setting.value = value;
}

function buildSettingsObjectFromMemory(): Record<TSettingName, any> {
  const nextPayload = {} as Record<TSettingName, any>;

  for (const item of AppSettings) {
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
