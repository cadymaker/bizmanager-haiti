'use client';

// ============================================================
// Zouti pou mòd offline nan POS la
// Nou sèvi ak localStorage (senp, sinkron, disponib toupatou).
// ============================================================

const PREFIX = 'bizmanager_offline_';

// Konbyen tan nou tann anvan nou konsidere koneksyon an mouri.
export const NET_TIMEOUT_MS = 6000;

// ---------- Kachèt jenerik ----------

function key(name: string, businessId: string) {
  return `${PREFIX}${name}_${businessId}`;
}

export function saveCache<T>(name: string, businessId: string, data: T) {
  try {
    localStorage.setItem(
      key(name, businessId),
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* espas plen oswa mòd prive — inyore */
  }
}

export function readCache<T>(name: string, businessId: string): T | null {
  try {
    const raw = localStorage.getItem(key(name, businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.data ?? null) as T;
  } catch {
    return null;
  }
}

export function cacheAge(name: string, businessId: string): number | null {
  try {
    const raw = localStorage.getItem(key(name, businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at) return null;
    return Date.now() - parsed.at;
  } catch {
    return null;
  }
}

// Kenbe dènye businessId a, konsa nou ka jwenn kachèt la
// menm anvan nou rive kontakte sèvè a.
export function saveLastBusinessId(businessId: string) {
  try {
    localStorage.setItem(PREFIX + 'last_business', businessId);
  } catch { /* inyore */ }
}

export function readLastBusinessId(): string | null {
  try {
    return localStorage.getItem(PREFIX + 'last_business');
  } catch {
    return null;
  }
}

// ---------- Deteksyon koneksyon ----------

// Anrejistre yon rekèt ak yon limit tan. Si li pran twò lontan,
// nou konsidere aparèy la offline epi nou kontinye ak kachèt la.
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number = NET_TIMEOUT_MS
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(null); }
    }, ms);

    Promise.resolve(promise).then(
      (val) => {
        if (!done) { done = true; clearTimeout(timer); resolve(val); }
      },
      () => {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      }
    );
  });
}

// Èske navigatè a panse li gen rezo?
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

// Fòma laj kachèt la an tèks lizib (Kreyòl)
export function formatCacheAge(ms: number | null): string {
  if (ms === null) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'kèk segond pase';
  if (min < 60) return `${min} minit pase`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} è pase`;
  const days = Math.floor(hours / 24);
  return `${days} jou pase`;
}

// ============================================================
// Fil datant pou vant offline
// ============================================================

export interface QueuedSaleItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface QueuedSale {
  local_id: string;        // ID inik lokal
  business_id: string;
  session_id: string;
  user_id: string;
  cashier_name: string;
  issue_date: string;      // YYYY-MM-DD (lè lokal)
  created_at: string;      // ISO
  currency: string;
  items: QueuedSaleItem[];
  total: number;
  cash_given: number;
  change: number;
  temp_number: string;     // nimewo resi tanporè (OFF-xxx)
  tries?: number;          // konbyen fwa nou eseye voye l
  last_error?: string;     // dènye erè (pou dyagnostik)
}

function queueKey(businessId: string) {
  return `${PREFIX}sale_queue_${businessId}`;
}

export function readQueue(businessId: string): QueuedSale[] {
  try {
    const raw = localStorage.getItem(queueKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(businessId: string, queue: QueuedSale[]) {
  try {
    localStorage.setItem(queueKey(businessId), JSON.stringify(queue));
  } catch {
    /* espas plen — inyore */
  }
}

export function addToQueue(businessId: string, sale: QueuedSale) {
  const q = readQueue(businessId);
  q.push(sale);
  writeQueue(businessId, q);
}

export function removeFromQueue(businessId: string, localId: string) {
  const q = readQueue(businessId).filter(s => s.local_id !== localId);
  writeQueue(businessId, q);
}

export function queueCount(businessId: string): number {
  return readQueue(businessId).length;
}

// Make yon vant kòm "echwe" ak yon rezon (pou dyagnostik)
export function markQueueError(businessId: string, localId: string, err: string) {
  const q = readQueue(businessId).map(s =>
    s.local_id === localId ? { ...s, last_error: err, tries: (s.tries ?? 0) + 1 } : s
  );
  writeQueue(businessId, q);
}

// Jenere pwochen nimewo resi tanporè (OFF-001, OFF-002, ...)
export function nextTempNumber(businessId: string): string {
  const k = `${PREFIX}temp_counter_${businessId}`;
  let n = 1;
  try {
    n = parseInt(localStorage.getItem(k) ?? '0', 10) + 1;
    localStorage.setItem(k, String(n));
  } catch { /* inyore */ }
  return `OFF-${String(n).padStart(3, '0')}`;
}

// ID inik lokal
export function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Aplike vant ki nan fil datant lan sou yon lis pwodwi.
// Kachèt la kenbe stock sèvè a; sa a bay stock reyèl la pou afiche.
export function applyQueueToProducts<T extends { id: string; quantity: number }>(
  products: T[],
  businessId: string
): T[] {
  const queue = readQueue(businessId);
  if (queue.length === 0) return products;

  const sold = new Map<string, number>();
  queue.forEach(sale => {
    sale.items.forEach(it => {
      sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + it.quantity);
    });
  });

  return products.map(p => {
    const qty = sold.get(p.id);
    return qty ? { ...p, quantity: Math.max(0, p.quantity - qty) } : p;
  });
}