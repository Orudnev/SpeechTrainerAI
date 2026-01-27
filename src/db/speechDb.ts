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
 * SpItem type
 */
export type SpItem = {
  uid: string;
  topic: string;
  q: string;
  a: string;

  fcnt?: number;
  rcnt?: number;
  faccTS?: number;
  raccTS?: number;
  fcorCnt?: number;
  rcorCnt?: number;
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

      fcnt INTEGER DEFAULT 0,
      rcnt INTEGER DEFAULT 0,

      faccTS INTEGER DEFAULT 0,
      raccTS INTEGER DEFAULT 0,

      fcorCnt INTEGER DEFAULT 0,
      rcorCnt INTEGER DEFAULT 0
    );
  `);
}

/**
 * Seed initial data if empty
 */
export async function seedSpeechDbIfEmpty() {
  const db = await openSpeechDb();

  const res = await db.executeSql(`SELECT COUNT(*) as cnt FROM phrases;`);
  const count = res[0].rows.item(0).cnt;

  if (count > 0) return;

  console.log("🌱 Seeding database...");

  const seed: Omit<SpItem, "uid">[] = [
    {
      topic: "basic",
      q: "Здравствуй мир",
      a: "hello world",
    },
    {
      topic: "rn",
      q: "React Native работает прекрасно",
      a: "react native is working perfectly",
    },
    {
      topic: "speech",
      q: "Распознавание речи и tts речи связаны",
      a: "voice recognition and tts are connected",
    },
  ];

  for (const item of seed) {
    await db.executeSql(
      `INSERT INTO phrases(uid, topic, q, a)
       VALUES(?, ?, ?, ?);`,
      [generatePseudoUniqueId(), item.topic, item.q, item.a]
    );
  }
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
    items.push(rows.item(i));
  }

  return items;
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
