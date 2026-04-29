import Database from "better-sqlite3";
import { SUBSCRIBERS_DB } from "../config.js";

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(SUBSCRIBERS_DB);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      guild_id INTEGER NOT NULL,
      user_id  INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);
  return _db;
}

export function dbInit(): void {
  db();
}

export function dbAdd(guildId: string | bigint, userId: string | bigint): boolean {
  const r = db()
    .prepare("INSERT OR IGNORE INTO subscribers (guild_id, user_id) VALUES (?, ?)")
    .run(BigInt(guildId), BigInt(userId));
  return r.changes > 0;
}

export function dbRemove(guildId: string | bigint, userId: string | bigint): boolean {
  const r = db()
    .prepare("DELETE FROM subscribers WHERE guild_id = ? AND user_id = ?")
    .run(BigInt(guildId), BigInt(userId));
  return r.changes > 0;
}

export function dbList(guildId: string | bigint): string[] {
  const rows = db()
    .prepare("SELECT user_id FROM subscribers WHERE guild_id = ?")
    .all(BigInt(guildId)) as Array<{ user_id: bigint }>;
  return rows.map((r) => r.user_id.toString());
}

export function dbCount(guildId: string | bigint): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM subscribers WHERE guild_id = ?")
    .get(BigInt(guildId)) as { n: number };
  return row.n;
}
