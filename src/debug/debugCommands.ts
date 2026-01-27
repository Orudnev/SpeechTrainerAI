import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  openSpeechDb,
  generatePseudoUniqueId,
  SpItem
} from "../db/speechDb";
import {dataRows} from "./testPhraseData";

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

export async function listAllRows(): Promise<void> {
  console.log("listAllRows");  
  const db = await openSpeechDb();
  console.log("listAllRows1");  

  const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);
  console.log("listAllRows2");  

  const rows = res[0].rows;
  console.log("listAllRows3");  

  for (let i = 0; i < rows.length; i++) {
    console.log("row:"+i);
    console.log(rows.item(i));
  }
}


