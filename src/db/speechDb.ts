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
};

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
      dwr REAL DEFAULT 0
    );
  `);

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

  const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);

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

  console.log("🌱 Seeding database...");

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

