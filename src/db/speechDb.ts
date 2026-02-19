import SQLite, { SQLiteDatabase } from "react-native-sqlite-storage";

SQLite.enablePromise(true);

/**
 * Generate pseudo UID
 */
export function generatePseudoUniqueId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const timestamp = Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-4);

  const randomPart = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");

  return timestamp + randomPart;
}

/**
 * ✅ New Variant structure
 */
export type Tvariant = {
  word: string;
  variants: string[];
};

/**
 * SpItem type
 */
export type SpItem = {
  uid: string;
  topic: string;
  q: string;
  a: string;
  variants?: Tvariant[]; //"фонетические" синонимы
  cntf?: number; //количество показов в прямом режиме
  cntr?: number; //количество показов в обратном режиме
  df?: number; // Средняя продолжительность ответа в миллисекундах в прямом режиме
  dr?: number; // Средняя продолжительность ответа в миллисекундах в обратном режиме
  dwf?: number; // Среднее количество миллисекунд приходящаяся на одно слово ответа п в прямом режиме
  dwr?: number; // Среднее количество миллисекунд приходящаяся на одно слово ответа п в обратном режиме
  tsf?: number; //timestamp последнего показа в прямом режиме
  tsr?: number; //timestamp последнего показа в обратном режиме
  correctf?: number; //количество правильных ответов в прямом режиме
  correctr?: number; //количество правильных ответов в обратном режиме
  streakf?: number; //текущая серия правильных ответов в прямом режиме
  streakr?: number; //текущая серия правильных ответов в обратном режиме
  mssf?: number; //вычисляемый memory stability score для прямого режима
  mssr?: number; //вычисляемый memory stability score для обратного режима
};

export type SpItemResult = Pick<
  SpItem,
  "cntf" | "cntr" | "df" | "dr" | "dwf" | "dwr" | "tsf" | "tsr"| "correctf" | "correctr" | "streakf" | "streakr"
>;

function getMssExpression(
  correctCol: string,
  cntCol: string,
  streakCol: string,
  dwCol: string,
  tsCol: string,
) {
  return `
    100.0
    * ((${correctCol} + 1.0) / (${cntCol} + 2.0))
    * (0.5 + 0.5 * min(1.0, max(0.3, 1.0 - (${dwCol} / 800.0))))
    * min(
      1.0,
      max(
        0.3,
        (((((strftime('%s', 'now') * 1000.0) - ${tsCol}) / 86400000.0) + 1.0) / 5.0)
      )
    )
    * min(1.0, max(0.5, 0.5 + (${streakCol} / 20.0)))
  `;
}

function getMssSelectClause() {
  return `
    ${getMssExpression("correctf", "cntf", "streakf", "dwf", "tsf")} AS mssf,
    ${getMssExpression("correctr", "cntr", "streakr", "dwr", "tsr")} AS mssr
  `;
}

let db: SQLiteDatabase | null = null;

/**
 * Open database
 */
export async function openSpeechDb() {
  if (db) return db;

  db = await SQLite.openDatabase({
    name: "speechtrainer.db",
    location: "default",
  });

  return db;
}

/**
 * Init schema
 */
export async function initSpeechDb() {
  const db = await openSpeechDb();

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS phrases (
      uid TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      q TEXT NOT NULL,
      a TEXT NOT NULL,
      variants TEXT DEFAULT NULL,
      cntf INTEGER DEFAULT 0,
      cntr INTEGER DEFAULT 0,
      df REAL DEFAULT 0,
      dr REAL DEFAULT 0,
      dwf REAL DEFAULT 0,
      dwr REAL DEFAULT 0,
      tsf INTEGER DEFAULT 0,
      tsr INTEGER DEFAULT 0,
      correctf INTEGER DEFAULT 0,
      correctr INTEGER DEFAULT 0,
      streakf INTEGER DEFAULT 0,
      streakr INTEGER DEFAULT 0
    );
  `);


  const tableSchemaRes = await db.executeSql(`
    SELECT sql
    FROM sqlite_master
    WHERE type='table' AND name='phrases';
  `);

  const tableSql = tableSchemaRes[0].rows.length
    ? String(tableSchemaRes[0].rows.item(0).sql ?? "")
    : "";

  if (tableSql.toLowerCase().includes("log(")) {
    await db.executeSql(`ALTER TABLE phrases RENAME TO phrases_legacy;`);

    await db.executeSql(`
      CREATE TABLE phrases (
        uid TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        q TEXT NOT NULL,
        a TEXT NOT NULL,
        variants TEXT DEFAULT NULL,
        cntf INTEGER DEFAULT 0,
        cntr INTEGER DEFAULT 0,
        df REAL DEFAULT 0,
        dr REAL DEFAULT 0,
        dwf REAL DEFAULT 0,
        dwr REAL DEFAULT 0,
        tsf INTEGER DEFAULT 0,
        tsr INTEGER DEFAULT 0,
        correctf INTEGER DEFAULT 0,
        correctr INTEGER DEFAULT 0,
        streakf INTEGER DEFAULT 0,
        streakr INTEGER DEFAULT 0
      );
    `);

    await db.executeSql(`
      INSERT INTO phrases (
        uid, topic, q, a, variants,
        cntf, cntr, df, dr, dwf, dwr, tsf, tsr,
        correctf, correctr, streakf, streakr
      )
      SELECT
        uid, topic, q, a, variants,
        cntf, cntr, df, dr, dwf, dwr, tsf, tsr,
        correctf, correctr, streakf, streakr
      FROM phrases_legacy;
    `);

    await db.executeSql(`DROP TABLE phrases_legacy;`);
  }

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS appSettings (
      settings TEXT DEFAULT NULL
    );
  `);   
}


/**
 * Load all phrases
 */
export async function loadAllPhrases(): Promise<SpItem[]> {
  const db = await openSpeechDb();

  const res = await db.executeSql(`
    SELECT
      phrases.*,
      ${getMssSelectClause()}
    FROM phrases
    ORDER BY topic;
  `);

  const rows = res[0].rows;
  const items: SpItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i);

    items.push({
      ...row,
      variants: row.variants
        ? JSON.parse(row.variants)
        : [],
    });
  }

  return items;
}

/**
 * Save variants into DB
 */
export async function saveVariantsToPhrase(
  uid: string,
  variants: Tvariant[]
) {
  const db = await openSpeechDb();

  await db.executeSql(
    `UPDATE phrases SET variants=? WHERE uid=?`,
    [JSON.stringify(variants), uid]
  );
}

/**
 * Save learning result into DB
 */
export async function saveResultToPhrase(
  uid: string,
  result: SpItemResult
) {
  const db = await openSpeechDb();

  await db.executeSql(
    `UPDATE phrases
      SET cntf=?, cntr=?, df=?, dr=?, dwf=?, dwr=?, tsf=?, tsr=?, correctf=?, correctr=?, streakf=?, streakr=?
      WHERE uid=?`,
    [
      result.cntf ?? 0,
      result.cntr ?? 0,
      result.df ?? 0,
      result.dr ?? 0,
      result.dwf ?? 0,
      result.dwr ?? 0,
      result.tsf ?? 0,
      result.tsr ?? 0,
      result.correctf ?? 0,
      result.correctr ?? 0,
      result.streakf ?? 0,
      result.streakr ?? 0,
      uid,
    ]
  );
}

/**
 * Sync rows with phrases table
 */
export async function syncPhrasesRows(rows: any[]) {
  const db = await openSpeechDb();

  for (const row of rows) {
    const existing = await db.executeSql(
      `SELECT uid FROM phrases WHERE uid=? LIMIT 1`,
      [row.uid]
    );
    let variantsArray = [];
    try{
      variantsArray = JSON.parse(row.variants ?? []);
    } catch(e) {
      console.log(`Wrong value format of ${row.variants} for uid ${row.uid}`);
    }    
    let variants = JSON.stringify(variantsArray);
    if (existing[0].rows.length > 0) {
      await db.executeSql(
        `UPDATE phrases
          SET topic=?, q=?, a=?, variants=?, cntf=?, cntr=?, df=?, dr=?, dwf=?, dwr=?, tsf=?, tsr=?, correctf=?, correctr=?, streakf=?, streakr=?
          WHERE uid=?`,
        [
          row.topic,
          row.q,
          row.a,
          variants,
          row.cntf ?? 0,
          row.cntr ?? 0,
          row.df ?? 0,
          row.dr ?? 0,
          row.dwf ?? 0,
          row.dwr ?? 0,
          row.tsf ?? null,
          row.tsr ?? null,
          row.correctf ?? 0,
          row.correctr ?? 0,
          row.streakf ?? 0,
          row.streakr ?? 0,
          row.uid,
        ]
      );

      continue;
    }

    await db.executeSql(
      `INSERT INTO phrases(
        uid, topic, q, a, variants, cntf, cntr, df, dr, dwf, dwr, tsf, tsr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.uid,
        row.topic,
        row.q,
        row.a,
        variants,
        row.cntf ?? 0,
        row.cntr ?? 0,
        row.df ?? 0,
        row.dr ?? 0,
        row.dwf ?? 0,
        row.dwr ?? 0,
        row.tsf ?? null,
        row.tsr ?? null,
      ]
    );
  }
}

/**
 * Reverse mode helper
 */
export function toReverse(item: SpItem): SpItem {
  return {
    ...item,
    q: item.a,
    a: item.q,
  };
}


export async function seedSpeechDbIfEmpty() {
  const db = await openSpeechDb();

  const res = await db.executeSql(`SELECT COUNT(*) as cnt FROM phrases;`);
  const count = res[0].rows.item(0).cnt;

  if (count > 0) return;

  console.log("Seeding database...");

  const seed: Omit<SpItem, "uid">[] = [
    {
      topic: "test",
      q: "Здравствуй мир",
      a: "hello world",
      variants: [],
    },
  ];

  for (const item of seed) {
    await db.executeSql(
      `INSERT INTO phrases(uid, topic, q, a, variants)
       VALUES(?, ?, ?, ?, ?);`,
      [
        generatePseudoUniqueId(),
        item.topic,
        item.q,
        item.a,
        JSON.stringify(item.variants ?? []),
      ]
    );
  }
}
