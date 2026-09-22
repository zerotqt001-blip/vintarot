import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";

export type SqliteConnection = {
  exec(sql: string): void;
  prepare(sql: string): unknown;
};

export type TransactionalD1Database = D1Database & {
  transaction<T>(work: () => Promise<T>): Promise<T>;
};

type SqliteValue = string | number | bigint | null | Uint8Array | ArrayBuffer;

type SqliteStatement = {
  all(...values: SqliteValue[]): unknown[];
  get(...values: SqliteValue[]): unknown;
  run(...values: SqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};

function normalizeValues(values: unknown[]): SqliteValue[] {
  return values.map((value) => {
    if (value === undefined) return null;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
      return value;
    }
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) return value;
    throw new TypeError("Unsupported SQLite bind value");
  });
}

function resultMeta(changes = 0, lastRowId: number | bigint = 0) {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: changes,
    last_row_id: Number(lastRowId),
    changed_db: changes > 0,
    changes,
  };
}

function plainRow<T>(row: unknown): T {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row as T;
  return Object.fromEntries(Object.entries(row)) as T;
}

export function createSqliteD1Database(sqlite: SqliteConnection): D1Database {
  const prepare = (sql: string): D1PreparedStatement => {
    let values: SqliteValue[] = [];
    const statement = {
      bind(...nextValues: unknown[]) {
        values = normalizeValues(nextValues);
        return statement;
      },
      async first<T = Record<string, unknown>>(_columnName?: string): Promise<T | null> {
        const row = (sqlite.prepare(sql) as SqliteStatement).get(...values);
        return row == null ? null : plainRow<T>(row);
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const rows = (sqlite.prepare(sql) as SqliteStatement).all(...values).map((row) => plainRow<T>(row));
        return { success: true, meta: resultMeta(), results: rows };
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const result = (sqlite.prepare(sql) as SqliteStatement).run(...values);
        const changes = Number(result.changes);
        return {
          success: true,
          meta: resultMeta(changes, result.lastInsertRowid),
          results: [],
        } as D1Result<T>;
      },
      async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
        const prepared = sqlite.prepare(sql) as SqliteStatement;
        if (options?.columnNames) {
          throw new Error("SQLite D1 raw columnNames mode is not supported by the VPS adapter");
        }
        return prepared.all(...values) as T[];
      },
    };
    return statement as unknown as D1PreparedStatement;
  };

  let batchTail: Promise<void> = Promise.resolve();
  let activeTransactionDepth = 0;

  async function runStatements<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const statement of statements) {
      results.push(await (statement as unknown as { run<T>(): Promise<D1Result<T>> }).run<T>());
    }
    return results;
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = batchTail.then(operation);
    batchTail = next.then(() => undefined, () => undefined);
    return next;
  }

  return {
    prepare,
    batch: async <T = unknown>(statements: D1PreparedStatement[]) => {
      if (activeTransactionDepth > 0) return runStatements<T>(statements);
      return enqueue(async () => {
        const results: D1Result<T>[] = [];
        let transactionStarted = false;
        try {
          sqlite.exec("BEGIN IMMEDIATE");
          transactionStarted = true;
          results.push(...await runStatements<T>(statements));
          sqlite.exec("COMMIT");
        } catch (error) {
          if (transactionStarted) {
            try {
              sqlite.exec("ROLLBACK");
            } catch {
              // Preserve the original statement failure.
            }
          }
          throw error;
        }
        return results;
      });
    },
    transaction: <T>(work: () => Promise<T>) => {
      if (activeTransactionDepth > 0) {
        activeTransactionDepth += 1;
        return work().finally(() => { activeTransactionDepth -= 1; });
      }
      return enqueue(async () => {
        let transactionStarted = false;
        try {
          sqlite.exec("BEGIN IMMEDIATE");
          transactionStarted = true;
          activeTransactionDepth = 1;
          const result = await work();
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          if (transactionStarted) {
            try {
              sqlite.exec("ROLLBACK");
            } catch {
              // Preserve the original operation failure.
            }
          }
          throw error;
        } finally {
          activeTransactionDepth = 0;
        }
      });
    },
  } as unknown as TransactionalD1Database;
}
