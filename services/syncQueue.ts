import { supabase } from './supabaseClient';

/**
 * Durable offline write queue.
 *
 * Writes go through `dbWrite`. When the device is offline (or a write fails
 * with a network error), the operation is persisted to localStorage and
 * replayed in FIFO order once connectivity returns. Inserts are replayed as
 * upserts (rows carry client-generated primary keys) so replay is idempotent
 * and a flaky-but-committed write is never duplicated.
 */

export type QueuedOp = {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload?: any;
  match?: Record<string, any>;
  ts: number;
  /**
   * Staff session token active when the write was authored. Replays are sent
   * under THIS token (not whoever is active at flush time), so RLS attributes
   * the write to the right operator.
   */
  staffToken?: string | null;
};

const currentStaffToken = (): string | null => {
  const headers = (supabase as any).rest?.headers || {};
  return headers['x-staff-token'] || null;
};

const STORAGE_KEY = 'haang_sync_queue_v1';
let flushing = false;
let listeners: Array<(n: number) => void> = [];

function load(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(q: QueuedOp[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch (e) {
    console.error('[syncQueue] failed to persist queue', e);
  }
  const n = q.length;
  listeners.forEach(l => {
    try { l(n); } catch { /* ignore listener errors */ }
  });
}

export function onQueueChange(fn: (n: number) => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getQueueLength(): number {
  return load().length;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isNetworkError(e: any): boolean {
  if (isOffline()) return true;
  if (!e) return false;
  const msg = (e.message || e.error_description || e.details || String(e)).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch') ||
    msg.includes('timeout')
  );
}

async function applyOp(op: QueuedOp): Promise<void> {
  // Replay under the authoring operator's session token, then restore.
  const headers = (supabase as any).rest?.headers || {};
  const prevToken = headers['x-staff-token'];
  const overrideToken = op.staffToken !== undefined;
  if (overrideToken) {
    if (op.staffToken) headers['x-staff-token'] = op.staffToken;
    else delete headers['x-staff-token'];
  }
  try {
    const table = supabase.from(op.table);
    let res: any;
    if (op.action === 'insert') {
      res = await table.upsert(op.payload); // idempotent replay via primary key
    } else if (op.action === 'update') {
      res = await table.update(op.payload).match(op.match || {});
    } else if (op.action === 'delete') {
      res = await table.delete().match(op.match || {});
    }
    if (res && res.error) throw res.error;
  } finally {
    if (overrideToken) {
      if (prevToken) headers['x-staff-token'] = prevToken;
      else delete headers['x-staff-token'];
    }
  }
}

function enqueue(op: Omit<QueuedOp, 'id' | 'ts'>) {
  const q = load();
  q.push({ staffToken: currentStaffToken(), ...op, id: genId(), ts: Date.now() });
  save(q);
}

/**
 * Perform a Supabase write with offline durability. Resolves immediately with
 * `{ queued: true }` when the op was stored for later sync, or `{ queued: false }`
 * when it was applied live. Non-network errors are surfaced (not queued).
 */
export async function dbWrite(op: Omit<QueuedOp, 'id' | 'ts'>): Promise<{ queued: boolean; error?: any }> {
  if (isOffline()) {
    enqueue(op);
    return { queued: true };
  }
  try {
    await applyOp({ ...op, id: 'live', ts: Date.now() });
    if (getQueueLength() > 0) flushQueue();
    return { queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue(op);
      return { queued: true };
    }
    console.error(`[syncQueue] write to ${op.table} failed (not queued):`, e);
    return { queued: false, error: e };
  }
}

/** Replay queued operations against Supabase, oldest first. */
export async function flushQueue(): Promise<void> {
  if (flushing || isOffline()) return;
  flushing = true;
  try {
    let q = load();
    while (q.length > 0) {
      const op = q[0];
      try {
        await applyOp(op);
        q = load();
        q.shift();
        save(q);
      } catch (e) {
        if (isNetworkError(e)) break; // still offline — try again later
        // Poison op (constraint / RLS / bad data): drop it so the queue drains.
        console.error('[syncQueue] dropping un-syncable op', op, e);
        q = load();
        q.shift();
        save(q);
      }
    }
  } finally {
    flushing = false;
  }
}

/** Wire up automatic draining. Call once at app startup. */
export function initSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { flushQueue(); });
  // Some browsers fire visibilitychange more reliably than online.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
  flushQueue();
}
