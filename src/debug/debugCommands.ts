import { DeviceEventEmitter } from "react-native";
import { getAppSettingValue, saveAppSettingsToDb, setAppSettingValue } from "../db/settings";
import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  openSpeechDb,
  generatePseudoUniqueId,
  SpItem,
  syncPhrasesRows,
  MSS,
  SpItemExport,
  executeSql
} from "../db/speechDb";
import { ReceiveAllRowsFromCloud, SendDatabaseToCloud } from "../helpers/webApiWrapper";
import { AsrService } from "../speech/asr/AsrService";
import { dataRows } from "./testPhraseData";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import { convertToTaskDisplayItem, CreateTask } from "../helpers/getNextItemUid";

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

function printRows(rows: SpItem[],allDirections:boolean) {
  const isReverse = getAppSettingValue<boolean>("reverseMode");
  const fml = (o:any, length: number) => {
    return o.toString().padEnd(length, " ").substr(0,length);
  };
  const fmr = (o:any, length: number) => {
    return o.toString().padStart(length, " ").substr(0,length);
  };
  for (let i = 0; i < rows.length; i++) {
    let r:any = rows[i];
    let lineNum = `${fmr(i, 3)}`;
    let str1 = `${lineNum} ${fml(r.uid,15)}cntf:${fmr(r.cntf, 5)} df:${fmr(r.df.toFixed(0),5)} dwf:${fmr(r.dwf.toFixed(0),5)} correctf:${fmr(r.correctf, 5)} streakf:${fmr(r.streakf, 5)} intf:${fmr(r.intf, 10)} mssf:${fmr(MSS(r),4)} ${fml(r.q,50)}`;
    let str2 = `${fml(r.topic,15)}cntr:${fmr(r.cntr, 5)} dr:${fmr(r.dr.toFixed(0),5)} dwr:${fmr(r.dwr.toFixed(0),5)} correctr:${fmr(r.correctr, 5)} streakr:${fmr(r.streakr, 5)} intr:${fmr(r.intr, 10)} mssr:${fmr(MSS(r,true),4)} ${r.a} variants:${r.variants}`;
    if(allDirections){
      console.log(`${str1}\n    ${str2}\n`);
    } else if(isReverse){
      console.log(`${lineNum} ${str2}`);
    } else {  
      console.log(str1);
    }
  }
}

async function listimpl(predicate?:()=>boolean,allDirections:boolean=true) {
  const db = await openSpeechDb();
  const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);
  let allRows = res[0].rows;
  let rows: SpItem[] = [];
  for (let i = 0; i < allRows.length; i++){
    rows.push(allRows.item(i));
  }
  if(predicate){
    rows = rows.filter(predicate);
  } 
  printRows(rows,allDirections);
}

export async function list(predicate?:()=>boolean) {
  listimpl(predicate,true);
}

export async function listc(predicate?:()=>boolean) {
  listimpl(predicate,false);
}

export function fireSpeechResultEvent(asrResultText: string) {
  DeviceEventEmitter.emit("SpeechResult", JSON.stringify({
    type: "partial",
    text: asrResultText,
    isError: false,
  }));
}

export async function getSelTopicItems(): Promise<SpItem[]> {
  const selectedTopics = getAppSettingValue<string[]>("selectedTopics");
  if (!selectedTopics || !Array.isArray(selectedTopics)) return [];
  
  // Build the SQL query with placeholders for IN clause
  const placeholders = selectedTopics.map(() => '?').join(',');
  const sql = `SELECT * FROM phrases WHERE topic IN (${placeholders})`;
  
  // Execute the query
  const db = await openSpeechDb();
  const res = await db.executeSql(sql, selectedTopics);
  // Extract rows

  let rows: SpItem[] = [];
  for (let i = 0; i < res[0].rows.length; i++) {
    rows.push(res[0].rows.item(i));
  }  
  return rows;
}

export async function test(){
  const selTopicItems = await getSelTopicItems();
  const taskItems = CreateTask(selTopicItems, 300,10,false).map(item => convertToTaskDisplayItem(item, false, Date.now()));
  printObjectArray(taskItems.map((r,idx) => ({idx:idx+1, uid: r.uid,  q: r.a, mss: r.mss, itmType: r.itmType })));
}


export function printObjectArray(objArray: any[]) {
  console.log("printObjectArray:");

  if (!Array.isArray(objArray)) {
    console.log("input is not an array");
    return;
  }

  if (objArray.length === 0) {
    console.log("[]");
    return;
  }

  const columns = Array.from(
    new Set(
      objArray.flatMap((item) =>
        item && typeof item === "object" ? Object.keys(item) : []
      )
    )
  );

  if (columns.length === 0) {
    console.log("array contains no object properties");
    return;
  }

  const stringifyCell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const widths = columns.map((column) => {
    const cellWidth = Math.max(
      ...objArray.map((item) => stringifyCell(item?.[column]).length)
    );
    return Math.max(column.length, cellWidth);
  });

  const pad = (value: string, width: number) => value.padEnd(width, " ");

  const header = columns
    .map((column, index) => pad(column, widths[index]))
    .join(" | ");

  const separator = widths
    .map((width) => "-".repeat(width))
    .join("-+-");

  console.log(header);
  console.log(separator);

  for (const item of objArray) {
    const row = columns
      .map((column, index) => pad(stringifyCell(item?.[column]), widths[index]))
      .join(" | ");
    console.log(row);
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
