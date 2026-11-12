import type { Database as DatabaseType } from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { hashPassword } from './auth.js'
import { Config } from './config.js'
import { colourLog } from './logger.js'

let db: DatabaseType | undefined
let cleanupInterval: NodeJS.Timeout | undefined
let walCheckpointInterval: NodeJS.Timeout | undefined
const FIVE_MINUTES = 5 * 60 * 1000

interface Row {
  key: string
  value: string
  expireTime?: number
}

export interface Collection {
  id: number
  name: string
  contents: string
  createdAt: number
  updatedAt: number
}

export interface Environment {
  id: number
  name: string
  values: string
  secretKeys: string
  createdAt: number
  updatedAt: number
}

export interface RequestHistory {
  id: number
  collectionId: number
  requestName: string
  method: string
  url: string
  status: number
  statusText: string
  executionMode: 'browser' | 'backend'
  executedAt: number
}

export interface BackupDocument {
  version: 1
  collections: Array<Pick<Collection, 'name' | 'contents'>>
  environments: Array<Pick<Environment, 'name' | 'values' | 'secretKeys'>>
}

export async function initialiseDatabase() {
  const dbPathString = Config.DB_PATH
  const dbPath = path.resolve(dbPathString)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  const query = `CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    expireTime INTEGER
  )`
  db.exec(query)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      username TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      tokenHash TEXT PRIMARY KEY,
      expireTime INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      contents TEXT NOT NULL DEFAULT '{}',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS environment (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      variables TEXT NOT NULL DEFAULT '{}',
      secretKeys TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requestHistory (
      id INTEGER PRIMARY KEY,
      collectionId INTEGER NOT NULL,
      requestName TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER NOT NULL,
      statusText TEXT NOT NULL,
      executionMode TEXT NOT NULL,
      executedAt INTEGER NOT NULL
    )
  `)
  const environmentColumns = db.prepare('PRAGMA table_info(environment)').all() as Array<{ name: string }>
  if (!environmentColumns.some(column => column.name === 'secretKeys')) {
    db.exec(`ALTER TABLE environment ADD COLUMN secretKeys TEXT NOT NULL DEFAULT '[]'`)
  }

  const user = db.prepare('SELECT username FROM user LIMIT 1').get()
  if (!user) {
    const passwordHash = await hashPassword(Config.AUTH_PASSWORD)
    db.prepare('INSERT INTO user (username, passwordHash) VALUES (?, ?)').run(Config.AUTH_USERNAME, passwordHash)
    colourLog('green', `Created initial user ${Config.AUTH_USERNAME}`)
  }

  startDbCleanupInterval(10 * 1000) // delete expired rows every 10 seconds
  startWalCheckpointInterval(10 * 60 * 1000) // check for checkpoint starvation every 10 minutes
}

export function closeDatabase() {
  if (cleanupInterval !== undefined) {
    clearInterval(cleanupInterval)
    cleanupInterval = undefined
  }
  if (walCheckpointInterval !== undefined) {
    clearInterval(walCheckpointInterval)
    walCheckpointInterval = undefined
  }
  if (db) {
    db.close()
    db = undefined
  }
}

function startDbCleanupInterval(intervalInMs: number) {
  deleteExpiredRows()
  cleanupInterval = setInterval(() => {
    deleteExpiredRows()
  }, intervalInMs)
}

function startWalCheckpointInterval(intervalInMs: number) {
  const walPath = path.resolve(`${Config.DB_PATH}-wal`)
  walCheckpointInterval = setInterval(() => {
    const walSize = fs.statSync(walPath).size
    if (walSize > 10 * 1024 * 1024) {
      // checkpoint if WAL file is larger than 10MB
      db?.pragma('wal_checkpoint(RESTART)')
      colourLog('purple', 'Performed WAL checkpoint restart due to WAL file size exceeding 10MB')
    }
  }, intervalInMs)
}

export function getRow(key: string): string | null {
  if (!db) {
    colourLog('red', `DB is undefined - cannot get row for key: ${key}`)
    return null
  }
  const stmt = db.prepare('SELECT value FROM cache WHERE key = ? AND (expireTime IS NULL OR expireTime > ?)')
  const row = stmt.get(key, Date.now()) as Row | undefined
  return row ? row.value : null
}

export function getAllRows(): Row[] {
  if (!db) {
    colourLog('red', 'DB is undefined - cannot get all rows')
    return []
  }
  const stmt = db.prepare('SELECT key, value, expireTime FROM cache WHERE expireTime IS NULL OR expireTime > ?')
  const rows = stmt.all(Date.now()) as Row[]
  return rows
}

export function putRow(key: string, value: string, ttl: number = FIVE_MINUTES): void {
  if (!db) {
    colourLog('red', `DB is undefined - cannot put row for key: ${key}`)
    return
  }
  const expireTime = Date.now() + ttl
  const stmt = db.prepare('INSERT OR REPLACE INTO cache (key, value, expireTime) VALUES (?, ?, ?)')
  stmt.run(key, value, expireTime)
}

export function deleteRow(key: string): void {
  if (!db) {
    colourLog('red', `DB is undefined - cannot delete row for key: ${key}`)
    return
  }
  const stmt = db.prepare('DELETE FROM cache WHERE key = ?')
  stmt.run(key)
}

export function deleteExpiredRows(): void {
  if (!db) {
    colourLog('red', 'DB is undefined - cannot delete expired rows')
    return
  }
  const stmt = db.prepare('DELETE FROM cache WHERE expireTime IS NOT NULL AND expireTime < ?')
  stmt.run(Date.now())
}

export function deleteAllRows(): void {
  if (!db) {
    colourLog('red', 'DB is undefined - cannot delete all rows')
    return
  }
  const stmt = db.prepare('DELETE FROM cache')
  stmt.run()
}

function getDatabase(): DatabaseType {
  if (!db) {
    throw new Error('Database is not initialised')
  }
  return db
}

export function getUser(username: string): { username: string, passwordHash: string } | undefined {
  return getDatabase().prepare('SELECT username, passwordHash FROM user WHERE username = ?').get(username) as { username: string, passwordHash: string } | undefined
}

export function getSingleUser(): { username: string, passwordHash: string } | undefined {
  return getDatabase().prepare('SELECT username, passwordHash FROM user LIMIT 1').get() as { username: string, passwordHash: string } | undefined
}

export function updateUserPassword(username: string, passwordHash: string): void {
  getDatabase().prepare('UPDATE user SET passwordHash = ? WHERE username = ?').run(passwordHash, username)
}

export function createSession(tokenHash: string, expireTime: number): void {
  getDatabase().prepare('INSERT INTO session (tokenHash, expireTime) VALUES (?, ?)').run(tokenHash, expireTime)
}

export function hasSession(tokenHash: string): boolean {
  return Boolean(getDatabase().prepare('SELECT 1 FROM session WHERE tokenHash = ? AND expireTime > ?').get(tokenHash, Date.now()))
}

export function deleteSession(tokenHash: string): void {
  getDatabase().prepare('DELETE FROM session WHERE tokenHash = ?').run(tokenHash)
}

export function listCollections(): Collection[] {
  return getDatabase().prepare('SELECT id, name, contents, createdAt, updatedAt FROM collection ORDER BY updatedAt DESC').all() as Collection[]
}

export function createBackup(): BackupDocument {
  return {
    version: 1,
    collections: listCollections().map(({ name, contents }) => ({ name, contents })),
    environments: listEnvironments().map(({ name, values, secretKeys }) => ({ name, values, secretKeys })),
  }
}

export function restoreBackup(backup: BackupDocument): { collections: number, environments: number } {
  const database = getDatabase()
  const restore = database.transaction(() => {
    const now = Date.now()
    const insertCollection = database.prepare('INSERT INTO collection (name, contents, createdAt, updatedAt) VALUES (?, ?, ?, ?)')
    const upsertEnvironment = database.prepare(`
      INSERT INTO environment (name, variables, secretKeys, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET variables = excluded.variables, secretKeys = excluded.secretKeys, updatedAt = excluded.updatedAt
    `)
    for (const collection of backup.collections) {
      insertCollection.run(collection.name, collection.contents, now, now)
    }
    for (const environment of backup.environments) {
      upsertEnvironment.run(environment.name, environment.values, environment.secretKeys, now, now)
    }
    return { collections: backup.collections.length, environments: backup.environments.length }
  })
  return restore()
}

export function getCollection(id: number): Collection | undefined {
  return getDatabase().prepare('SELECT id, name, contents, createdAt, updatedAt FROM collection WHERE id = ?').get(id) as Collection | undefined
}

export function createCollection(name: string, contents: string): Collection {
  const now = Date.now()
  const result = getDatabase().prepare('INSERT INTO collection (name, contents, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(name, contents, now, now)
  return getDatabase().prepare('SELECT id, name, contents, createdAt, updatedAt FROM collection WHERE id = ?').get(result.lastInsertRowid) as Collection
}

export function updateCollection(id: number, name: string, contents: string): Collection | undefined {
  getDatabase().prepare('UPDATE collection SET name = ?, contents = ?, updatedAt = ? WHERE id = ?').run(name, contents, Date.now(), id)
  return getDatabase().prepare('SELECT id, name, contents, createdAt, updatedAt FROM collection WHERE id = ?').get(id) as Collection | undefined
}

export function deleteCollection(id: number): void {
  const database = getDatabase()
  database.transaction(() => {
    database.prepare('DELETE FROM requestHistory WHERE collectionId = ?').run(id)
    database.prepare('DELETE FROM collection WHERE id = ?').run(id)
  })()
}

export function listRequestHistory(collectionId: number): RequestHistory[] {
  return getDatabase().prepare(`
    SELECT id, collectionId, requestName, method, url, status, statusText, executionMode, executedAt
    FROM requestHistory
    WHERE collectionId = ?
    ORDER BY executedAt DESC
    LIMIT 100
  `).all(collectionId) as RequestHistory[]
}

export function createRequestHistory(history: Omit<RequestHistory, 'id' | 'executedAt'>): RequestHistory {
  const executedAt = Date.now()
  const result = getDatabase().prepare(`
    INSERT INTO requestHistory (collectionId, requestName, method, url, status, statusText, executionMode, executedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(history.collectionId, history.requestName, history.method, history.url, history.status, history.statusText, history.executionMode, executedAt)
  return getDatabase().prepare(`
    SELECT id, collectionId, requestName, method, url, status, statusText, executionMode, executedAt
    FROM requestHistory WHERE id = ?
  `).get(result.lastInsertRowid) as RequestHistory
}

export function listEnvironments(): Environment[] {
  return getDatabase().prepare('SELECT id, name, variables AS "values", secretKeys, createdAt, updatedAt FROM environment ORDER BY name').all() as Environment[]
}

export function getEnvironment(id: number): Environment | undefined {
  return getDatabase().prepare('SELECT id, name, variables AS "values", secretKeys, createdAt, updatedAt FROM environment WHERE id = ?').get(id) as Environment | undefined
}

export function createEnvironment(name: string, values: string, secretKeys: string): Environment {
  const now = Date.now()
  const result = getDatabase().prepare('INSERT INTO environment (name, variables, secretKeys, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)').run(name, values, secretKeys, now, now)
  return getEnvironment(Number(result.lastInsertRowid)) as Environment
}

export function updateEnvironment(id: number, name: string, values: string, secretKeys: string): Environment | undefined {
  getDatabase().prepare('UPDATE environment SET name = ?, variables = ?, secretKeys = ?, updatedAt = ? WHERE id = ?').run(name, values, secretKeys, Date.now(), id)
  return getEnvironment(id)
}

export function deleteEnvironment(id: number): void {
  getDatabase().prepare('DELETE FROM environment WHERE id = ?').run(id)
}
