// A tiny promise wrapper over the raw IndexedDB API (no dependency), plus an in-memory twin
// with the same interface for tests. Used only by offlineQueue.ts.

export interface KV<T> {
  getAll(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
  delete(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'byp-offline';
const DB_VERSION = 1;
export const STORES = ['pending', 'cache'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  dbPromise = opening;
  opening.catch(() => {
    dbPromise = null; // allow a later retry
  });
  return opening;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function result<R>(req: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export function idbStore<T>(name: StoreName): KV<T> {
  return {
    async getAll() {
      const db = await openDb();
      return result(db.transaction(name).objectStore(name).getAll() as IDBRequest<T[]>);
    },
    async get(key) {
      const db = await openDb();
      return result(db.transaction(name).objectStore(name).get(key) as IDBRequest<T | undefined>);
    },
    async put(key, value) {
      const db = await openDb();
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).put(value, key);
      await done(tx);
    },
    async delete(keys) {
      const db = await openDb();
      const tx = db.transaction(name, 'readwrite');
      for (const k of keys) tx.objectStore(name).delete(k);
      await done(tx);
    },
    async clear() {
      const db = await openDb();
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
      await done(tx);
    },
  };
}

export function memoryStore<T>(): KV<T> & { size(): number } {
  const m = new Map<string, T>();
  return {
    async getAll() {
      return [...m.values()];
    },
    async get(key) {
      return m.get(key);
    },
    async put(key, value) {
      m.set(key, structuredClone(value));
    },
    async delete(keys) {
      keys.forEach((k) => m.delete(k));
    },
    async clear() {
      m.clear();
    },
    size: () => m.size,
  };
}
