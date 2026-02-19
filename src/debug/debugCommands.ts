import { saveAppSettingsToDb, setAppSettingValue } from "../db/settings";
import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  openSpeechDb,
  generatePseudoUniqueId,
  SpItem,
  syncPhrasesRows
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
  await SendDatabaseToCloud(rows);
  console.log("Local database synchronized to cloud");
}

export async function listAllRows(): Promise<void> {
  const db = await openSpeechDb();

  const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);

  const rows = res[0].rows;

  const fml = (o:any, length: number) => {
    return o.toString().padEnd(length, " ");
  };
  const fmr = (o:any, length: number) => {
    return o.toString().padStart(length, " ");
  };
  for (let i = 0; i < rows.length; i++) {
    let r = rows.item(i);
    let str1 = `${fmr(i, 3)} ${fml(r.uid,15)}cntf:${fmr(r.cntf, 5)}\tdf:${fmr(r.df.toFixed(0),6)} \tdwf:${fmr(r.dwf.toFixed(0),6)} \tcorrectf:${fmr(r.correctf, 5)} \tstreakf:${fmr(r.streakf, 5)} \t${r.q}\tmssf:${r.mssf}`;
    let str2 = `    ${fml(r.topic,15)}cntr:${fmr(r.cntr, 5)}\tdr:${fmr(r.dr.toFixed(0),6)} \tdwr:${fmr(r.dwr.toFixed(0),6)} \tcorrectr:${fmr(r.correctr, 5)} \tstreakr:${fmr(r.streakr, 5)}\t${r.q}\tmssf:${r.mssf} \t${r.a} variants:${r.variants}`;
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
