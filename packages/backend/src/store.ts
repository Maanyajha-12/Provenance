import { Pool, type PoolClient } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
export interface StateStore {
  load<T>(): Promise<T | null>;
  save(value: unknown): Promise<void>;
  close(): Promise<void>;
}
export class FileStore implements StateStore {
  constructor(readonly path = "data/demo-state.json") {}
  async load<T>(): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(value: unknown) {
    await mkdir("data", { recursive: true });
    await writeFile(this.path + ".tmp", JSON.stringify(value));
    await rename(this.path + ".tmp", this.path);
  }
  async close() {}
}
export class PostgresStore implements StateStore {
  private pool: Pool;
  private client?: PoolClient;
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 1 });
  }
  async init() {
    this.client = await this.pool.connect();
    const lock = await this.client.query(
      "SELECT pg_try_advisory_lock(734991025) AS acquired",
    );
    if (!lock.rows[0].acquired)
      throw new Error("Another allocator owns the database lock");
    await this.client.query(
      "CREATE TABLE IF NOT EXISTS fund_state (id integer PRIMARY KEY CHECK (id=1), value jsonb NOT NULL)",
    );
  }
  async load<T>(): Promise<T | null> {
    if (!this.client) await this.init();
    const r = await this.client!.query(
      "SELECT value FROM fund_state WHERE id=1",
    );
    return r.rows[0]?.value ?? null;
  }
  async save(value: unknown) {
    await this.client!.query(
      "INSERT INTO fund_state(id,value) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value",
      [JSON.stringify(value)],
    );
  }
  async close() {
    this.client?.release();
    await this.pool.end();
  }
}
