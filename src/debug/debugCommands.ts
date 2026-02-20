import { saveAppSettingsToDb, setAppSettingValue } from "../db/settings";
import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  openSpeechDb,
  generatePseudoUniqueId,
  SpItem,
  syncPhrasesRows,
  MSS,
  SpItemExport
} from "../db/speechDb";
import { ReceiveAllRowsFromCloud, SendDatabaseToCloud } from "../helpers/webApiWrapper";
import { AsrService } from "../speech/asr/AsrService";
import { dataRows } from "./testPhraseData";

export async function dropPhrasesTable() {
  const db = await openSpeechDb();

  await db.executeSql("DROP TABLE IF EXISTS phrases;");

  console.log("💥 Table phrases dropped");
}

export async function clearDb() {
  const db = await openSpeechDb();
  await db.executeSql("DELETE FROM phrases;");
  console.log("🧹 Database cleared");
}

export async function reseedDb() {
  await dropPhrasesTable();
  await initSpeechDb();
  const db = await openSpeechDb();
  for (const item of dataRows.data) {
    await db.executeSql(
      `INSERT INTO phrases(uid, topic, q, a)
         VALUES(?, ?, ?, ?);`,
      [item.Uid, item.SheetName, item.Ru, item.En]
    );
  }
  console.log("🌱 Database reseeded");
}

export async function synchCloudToLocal() {
  let response = await ReceiveAllRowsFromCloud();
  if (!response.ok) {
    throw new Error("HTTP error " + response.status);
  }
  const rows = await response.json();
  await syncPhrasesRows(rows);
  console.log("Cloud data synchronized to local database");
}

export async function synchLocalToCloud() {
  let rows = await loadAllPhrases();
  let rowsExp: SpItemExport[] = rows.map(r => ({
    ...r,
    mssf: MSS(r),
    mssr: MSS(r,true)
  }));
  await SendDatabaseToCloud(rowsExp);
  console.log("Local database synchronized to cloud");
}

export async function listAllRows(): Promise<void> {
  const db = await openSpeechDb();

  const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);

  const rows = res[0].rows;

  const fml = (o:any, length: number) => {
    return o.toString().padEnd(length, " ").substr(0,length);
  };
  const fmr = (o:any, length: number) => {
    return o.toString().padStart(length, " ").substr(0,length);
  };
  for (let i = 0; i < rows.length; i++) {
    let r = rows.item(i);
    let str1 = `${fmr(i, 3)} ${fml(r.uid,15)}cntf:${fmr(r.cntf, 5)} df:${fmr(r.df.toFixed(0),6)} dwf:${fmr(r.dwf.toFixed(0),6)} correctf:${fmr(r.correctf, 5)} streakf:${fmr(r.streakf, 5)} mssf:${fmr(MSS(r),4)} ${r.q}`;
    let str2 = `    ${fml(r.topic,15)}cntr:${fmr(r.cntr, 5)} dr:${fmr(r.dr.toFixed(0),6)} dwr:${fmr(r.dwr.toFixed(0),6)} correctr:${fmr(r.correctr, 5)} streakr:${fmr(r.streakr, 5)} mssr:${fmr(MSS(r,true),4)} ${r.a} variants:${r.variants}`;
    console.log(`${str1}\n${str2}`);
  }
}

export async function asrinit() {
  await AsrService.initAllEngines();
}

export async function asrshutdown() {
  console.log("shutdown");
  await AsrService.shutdownAllEngines();
}

export function grantFullAccess() {
  setAppSettingValue("fullAccess", true);
  saveAppSettingsToDb();
  console.log("Full access granted");
}
