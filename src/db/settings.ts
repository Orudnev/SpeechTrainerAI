export type TSettingName =
  | 'fullAccess'
  | 'reverseMode'
  | 'rowsCloudDataSource'
  | 'selectedTopics';
export type TServiceCommandName = 'downloadRowsFromCloud' | 'uploadRowsToCloud';

import {initSpeechDb, openSpeechDb} from './speechDb';

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
];

type TappSettingsPayload = Record<TSettingName, any>;

function getDefaultsPayload(): TappSettingsPayload {
  return {
    fullAccess: false,
    reverseMode: false,
    selectedTopics: [],
    rowsCloudDataSource: '',
  };
}

function applySettingsPayload(payload: TappSettingsPayload) {
  for (const item of AppSettings) {
    item.value = payload[item.name] ?? item.defaultValue;
  }
}

export function getAppSettingValue<T = any>(name: TSettingName): T {
  const found = AppSettings.find(setting => setting.name === name);
  if (!found) {
    throw new Error(`Unknown setting: ${name}`);
  }

  return (found.value ?? found.defaultValue) as T;
}

export function buildSettingsPayloadFromMemory(): TappSettingsPayload {
  const defaults = getDefaultsPayload();
  const nextPayload: TappSettingsPayload = {...defaults};

  for (const item of AppSettings) {
    nextPayload[item.name] = item.value ?? item.defaultValue;
  }

  return nextPayload;
}

export async function loadAppSettingsFromDb() {
  await initSpeechDb();
  const db = await openSpeechDb();

  const defaults = getDefaultsPayload();
  const res = await db.executeSql(
    `SELECT settings FROM appSettings ORDER BY rowid DESC LIMIT 1;`,
  );

  if (res[0].rows.length === 0) {
    applySettingsPayload(defaults);
    return;
  }

  let parsed: Partial<TappSettingsPayload> = {};
  const row = res[0].rows.item(0);

  if (row?.settings) {
    try {
      parsed = JSON.parse(row.settings);
    } catch (e) {
      parsed = {};
    }
  }

  applySettingsPayload({
    ...defaults,
    ...parsed,
  });
}

export async function saveAppSettingsToDb() {
  await initSpeechDb();
  const db = await openSpeechDb();

  const payload = buildSettingsPayloadFromMemory();
  const payloadJson = JSON.stringify(payload);

  const rowRes = await db.executeSql(
    `SELECT COUNT(*) as cnt FROM appSettings;`,
  );

  if (rowRes[0].rows.item(0).cnt === 0) {
    await db.executeSql(`INSERT INTO appSettings(settings) VALUES(?);`, [
      payloadJson,
    ]);
    return;
  }

  await db.executeSql(`UPDATE appSettings SET settings=?;`, [payloadJson]);
}
