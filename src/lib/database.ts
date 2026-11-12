import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import postgres from 'postgres';
import {privateDataPath} from './private-path.ts';
import {protectPrivateDirectory} from './private-directory.ts';
import {supabaseRootCa} from './supabase-ca.ts';

type SqlValue = string | number | bigint | Uint8Array | null;

export interface DataConnection {
  readonly engine: 'sqlite' | 'postgres';
  get<T>(statement: string, ...values: SqlValue[]): Promise<T | undefined>;
  all<T>(statement: string, ...values: SqlValue[]): Promise<T[]>;
  run(statement: string, ...values: SqlValue[]): Promise<number>;
  transaction<T>(work: (connection: DataConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class DatabaseUnavailable extends Error {
  constructor(cause?: unknown) {
    super('Storage is temporarily unavailable. Try again shortly.', {cause});
    this.name = 'DatabaseUnavailable';
  }
}

const localSchema = `
  PRAGMA busy_timeout=5000;
  PRAGMA foreign_keys=ON;
  PRAGMA journal_mode=WAL;
  PRAGMA secure_delete=ON;
  CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,demo INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS bottles(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS bottles_owner ON bottles(user_id);
  CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS archive_consents(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,epoch INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS wear_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS events_owner ON wear_events(user_id,created);
  CREATE TABLE IF NOT EXISTS recommendation_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS outfit_analyses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS saved_looks(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,analysis_id TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(user_id,analysis_id));
  CREATE TABLE IF NOT EXISTS private_photos(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,analysis_id TEXT NOT NULL,look_id TEXT REFERENCES saved_looks(id) ON DELETE CASCADE,sealed BLOB NOT NULL,expires INTEGER,UNIQUE(user_id,analysis_id),CHECK((look_id IS NULL AND expires IS NOT NULL) OR (look_id IS NOT NULL AND expires IS NULL)));
  CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ai_credentials(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,model TEXT NOT NULL,sealed TEXT NOT NULL,PRIMARY KEY(user_id,provider));
  CREATE TABLE IF NOT EXISTS ai_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,selected TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS catalog_admins(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS catalog_photos(
    edition_id TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('automatic','override')),
    image_hash TEXT,bytes BLOB,source_url TEXT,publisher TEXT,updated_at INTEGER NOT NULL,
    PRIMARY KEY(edition_id,mode),CHECK((image_hash IS NULL)=(bytes IS NULL))
  );
  CREATE INDEX IF NOT EXISTS catalog_photo_hash ON catalog_photos(image_hash);
  CREATE TABLE IF NOT EXISTS catalog_photo_attempts(edition_id TEXT PRIMARY KEY,retry_at INTEGER NOT NULL,lease_until INTEGER NOT NULL);
  INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));
`;

class SqliteConnection implements DataConnection {
  readonly engine = 'sqlite';
  private tail: Promise<unknown> = Promise.resolve();
  private readonly db: DatabaseSync;
  private readonly scoped: boolean;

  constructor(db: DatabaseSync, scoped = false) {
    this.db = db;
    this.scoped = scoped;
  }

  // One local connection cannot interleave unrelated requests with an open transaction.
  private async exclusively<T>(work: () => T | Promise<T>): Promise<T> {
    if (this.scoped) return work();
    const pending = this.tail.then(work);
    this.tail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private async query<T>(work: () => T): Promise<T> {
    return this.exclusively(() => {
      try { return work(); }
      catch (cause) { throw new DatabaseUnavailable(cause); }
    });
  }

  get<T>(statement: string, ...values: SqlValue[]) {
    return this.query(() => this.db.prepare(statement).get(...values) as T | undefined);
  }

  all<T>(statement: string, ...values: SqlValue[]) {
    return this.query(() => this.db.prepare(statement).all(...values) as T[]);
  }

  run(statement: string, ...values: SqlValue[]) {
    return this.query(() => Number(this.db.prepare(statement).run(...values).changes));
  }

  transaction<T>(work: (connection: DataConnection) => Promise<T>): Promise<T> {
    if (this.scoped) throw new Error('A scoped connection is already in a transaction.');
    return this.exclusively(async () => {
      try { this.db.exec('BEGIN IMMEDIATE'); }
      catch (cause) { throw new DatabaseUnavailable(cause); }
      try {
        const result = await work(new SqliteConnection(this.db, true));
        try { this.db.exec('COMMIT'); }
        catch (cause) { throw new DatabaseUnavailable(cause); }
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }

  close() {
    if (this.scoped) throw new Error('Only the root connection can be closed.');
    return this.exclusively(() => { this.db.close(); });
  }
}

export function openSqlite(path: string): DataConnection {
  if (path !== ':memory:') {
    path = privateDataPath(path);
    protectPrivateDirectory(path);
    mkdirSync(dirname(path), {recursive: true});
  }
  const db = new DatabaseSync(path);
  try {
    db.exec(localSchema);
    const now = Date.now();
    db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
    db.prepare('DELETE FROM users WHERE demo = 1 AND created <= ?').run(now - 7 * 86400000);
    db.prepare('DELETE FROM recommendation_runs WHERE created <= ?').run(now - 86400000);
    return new SqliteConnection(db);
  } catch (error) {
    db.close();
    throw error;
  }
}

const pgTypes = {
  int8: {
    to: 20,
    from: [20],
    serialize: (value: number) => String(value),
    parse: (value: string) => {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error('A stored integer is out of range.');
      return number;
    },
  },
};
type PgPool = postgres.Sql<{int8: number}>;
type PgClient = PgPool | postgres.TransactionSql<{int8: number}>;

class PostgresConnection implements DataConnection {
  readonly engine = 'postgres';
  private readonly client: PgClient;
  private readonly pool?: PgPool;

  constructor(client: PgClient, pool?: PgPool) {
    this.client = client;
    this.pool = pool;
  }

  private async query(statement: string, values: SqlValue[]) {
    let index = 0;
    // Repository statements use positional bindings. Values never enter the SQL text.
    const sql = statement.replace(/\?/g, () => '$' + ++index);
    try {
      return await this.client.unsafe(sql, values.map(value =>
        value instanceof Uint8Array ? Buffer.from(value) : value));
    } catch (cause) {
      throw new DatabaseUnavailable(cause);
    }
  }

  async get<T>(statement: string, ...values: SqlValue[]) {
    return (await this.query(statement, values))[0] as T | undefined;
  }

  async all<T>(statement: string, ...values: SqlValue[]) {
    return Array.from(await this.query(statement, values)) as T[];
  }

  async run(statement: string, ...values: SqlValue[]) {
    return (await this.query(statement, values)).count;
  }

  async transaction<T>(work: (connection: DataConnection) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('A scoped connection is already in a transaction.');
    let workFailed = false;
    try {
      const result = await this.pool.begin(async client => {
        try { return {value: await work(new PostgresConnection(client))}; }
        catch (error) { workFailed = true; throw error; }
      });
      return result.value;
    } catch (cause) {
      if (workFailed) throw cause;
      throw new DatabaseUnavailable(cause);
    }
  }

  async close() {
    if (!this.pool) throw new Error('Only the root connection can be closed.');
    await this.pool.end({timeout: 5});
  }
}

export function openConfiguredDatabase(env: Record<string, string | undefined> = process.env): DataConnection {
  const url = env.FRAGOUT_DATABASE_URL?.trim();
  if (!url) return openSqlite(privateDataPath(env.FRAGOUT_DB));
  const key = env.FRAGOUT_VAULT_KEY;
  if (!key || Buffer.from(key, 'base64').length !== 32) throw new DatabaseUnavailable();

  try {
    const address = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(address.protocol) ||
        !address.username || !address.password || !address.hostname || address.pathname.length < 2) {
      throw new Error('Invalid Postgres connection settings.');
    }
    // Use the deployment's driver settings even if a copied URL includes other options.
    address.search = '';
    address.hash = '';
    const supabasePooler = address.hostname.endsWith('.pooler.supabase.com');
    if (supabasePooler && address.port === '6543') {
      // Supavisor transaction mode can drop pipelined query responses.
      throw new Error('Use the Supabase session pooler on port 5432.');
    }
    const supabase = supabasePooler ||
      /^db\.[a-z0-9]+\.supabase\.co$/.test(address.hostname);
    const pool = postgres(address.toString(), {
      ssl: supabase ? {ca: supabaseRootCa, rejectUnauthorized: true, servername: address.hostname} : 'verify-full',
      prepare: false,
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
      queue_timeout: 10,
      query_timeout: 25,
      types: pgTypes,
    });
    return new PostgresConnection(pool, pool);
  } catch (cause) {
    throw new DatabaseUnavailable(cause);
  }
}
