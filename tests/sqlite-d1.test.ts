import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createSqliteD1Database } from "../lib/sqlite-d1";

test("SQLite adapter supports bind, all, first, and run metadata", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");

  await database.prepare("INSERT INTO items (id, value) VALUES (?, ?)")
    .bind("one", 1)
    .run();
  const first = await database.prepare("SELECT id, value FROM items WHERE id = ?")
    .bind("one")
    .first<{ id: string; value: number }>();
  const all = await database.prepare("SELECT id, value FROM items ORDER BY id")
    .all<{ id: string; value: number }>();
  const update = await database.prepare("UPDATE items SET value = ? WHERE id = ?")
    .bind(2, "one")
    .run();

  assert.deepEqual(first, { id: "one", value: 1 });
  assert.deepEqual(all.results, [{ id: "one", value: 1 }]);
  assert.equal(update.meta.changes, 1);
  sqlite.close();
});

test("SQLite adapter executes a batch in order", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");
  const statements = [1, 2, 3].map((value) => database
    .prepare("INSERT INTO items (id, value) VALUES (?, ?)")
    .bind(`item-${value}`, value));

  await database.batch(statements);
  const rows = await database.prepare("SELECT value FROM items ORDER BY value")
    .all<{ value: number }>();
  assert.deepEqual(rows.results, [{ value: 1 }, { value: 2 }, { value: 3 }]);
  sqlite.close();
});

test("SQLite adapter serializes concurrent batches on one connection", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");
  const statements = (prefix: string) => [1, 2, 3].map((value) => database
    .prepare("INSERT INTO items (id, value) VALUES (?, ?)")
    .bind(`${prefix}-${value}`, value));

  await Promise.all([
    database.batch(statements("first")),
    database.batch(statements("second")),
  ]);
  const rows = await database.prepare("SELECT id, value FROM items ORDER BY id")
    .all<{ id: string; value: number }>();
  assert.deepEqual(rows.results, [
    { id: "first-1", value: 1 },
    { id: "first-2", value: 2 },
    { id: "first-3", value: 3 },
    { id: "second-1", value: 1 },
    { id: "second-2", value: 2 },
    { id: "second-3", value: 3 },
  ]);
  sqlite.close();
});

test("SQLite adapter rolls back a failed batch atomically", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");
  await assert.rejects(database.batch([
    database.prepare("INSERT INTO items (id, value) VALUES (?, ?)").bind("item-1", 1),
    database.prepare("INSERT INTO items (id, value) VALUES (?, ?)").bind("item-1", 2),
  ]));
  const rows = await database.prepare("SELECT * FROM items").all();
  assert.deepEqual(rows.results, []);
  sqlite.close();
});
