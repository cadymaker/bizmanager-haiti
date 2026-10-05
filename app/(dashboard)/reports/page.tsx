'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

type PeriodValue = 'today' | '7' | '30' | 'this_month' | 'last_month' | 'custom';
type SortKey = 'quantity' | 'revenue' | 'profit';

interface Totals {
  sales: number;
  cost: number;
  expenses: number;
  loss: number;
  discount: number;
  count: number;
}

interface ProductRow {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
}

interface DeadRow {
  id: string;
  name: string;
  quantity: number;
  value: number;
}

interface DayPoint {
  date: string;  // YYYY-MM-DD
  label: string; // JJ/MM
  total: number;
}

const EMPTY: Totals = { sales: 0, cost: 0, expenses: 0, loss: 0, discount: 0, count: 0 };

const PERIODS: { value: PeriodValue; label: string }[] = [
  { value: 'today', label: 'Jodi a' },
  { value: '7', label: '7 jou' },
  { value: '30', label: '30 jou' },
  { value: 'this_month', label: 'Mwa sa a' },
  { value: 'last_month', label: 'Mwa pase' },
  { value: 'custom', label: 'Peryòd pèsonalize' },
];

// ===== Dat =====
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function dayStartISO(d: Date): string {
  return startOfDay(d).toISOString();
}
function nextDayISO(d: Date): string {
  return addDays(startOfDay(d), 1).toISOString();
}
function fmtDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
// Konvèti nenpòt valè dat (dat senp OSWA timestamp) an jou lokal YYYY-MM-DD
function toLocalDay(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return localDate(d);
}

// Peryòd aktyèl la + peryòd pou konparezon an
function getRange(period: PeriodValue, customStart: string, customEnd: string) {
  const today = startOfDay(new Date());
  const y = today.getFullYear();
  const m = today.getMonth();

  let start = today;
  let end = today;
  let prevStart = addDays(today, -1);
  let prevEnd = addDays(today, -1);
  let compareLabel = 'pa rapò ak yè';

  if (period === '7' || period === '30') {
    const len = period === '7' ? 7 : 30;
    start = addDays(today, -(len - 1));
    end = today;
    prevEnd = addDays(start, -1);
    prevStart = addDays(start, -len);
    compareLabel = `pa rapò ak ${len} jou anvan yo`;
  } else if (period === 'this_month') {
    start = new Date(y, m, 1);
    end = today;
    prevStart = new Date(y, m - 1, 1);
    const lastOfPrev = new Date(y, m, 0);
    const candidate = addDays(prevStart, daysBetween(start, end));
    prevEnd = candidate > lastOfPrev ? lastOfPrev : candidate;
    compareLabel = 'pa rapò ak menm peryòd mwa pase';
  } else if (period === 'last_month') {
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 0);
    prevStart = new Date(y, m - 2, 1);
    prevEnd = new Date(y, m - 1, 0);
    compareLabel = 'pa rapò ak mwa anvan an';
  } else if (period === 'custom' && customStart && customEnd) {
    start = parseLocal(customStart);
    end = parseLocal(customEnd);
    const len = daysBetween(start, end) + 1;
    prevEnd = addDays(start, -1);
    prevStart = addDays(start, -len);
    compareLabel = 'pa rapò ak peryòd anvan an';
  }

  return { start, end, prevStart, prevEnd, compareLabel };
}

// Rale TOUT liy yo pa pakè 1000 (Supabase limite chak rekèt a 1000 liy)
async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<T[]> {
  const size = 1000;
  let from = 0;
  const out: T[] = [];
  while (true) {
    const { data, error } = await make(from, from + size - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
    from += size;
  }
  return out;
}

// Ti endikatè % pa rapò ak peryòd anvan an
function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-xs font-medium text-gray-500">Nouvo</span>;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className={`text-xs font-medium ${good ? 'text-green-600' : 'text-red-600'}`}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function StatCard({
  label, value, valueClass, sub, delta,
}: {
  label: string; value: string; valueClass?: string; sub?: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${valueClass ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date();
  const [period, setPeriod] = useState<PeriodValue>('today');
  const [customStart, setCustomStart] = useState(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(localDate(today));
  const [rangeError, setRangeError] = useState('');

  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [cur, setCur] = useState<Totals>(EMPTY);
  const [prev, setPrev] = useState<Totals>(EMPTY);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [deadRows, setDeadRows] = useState<DeadRow[]>([]);
  const [dayPoints, setDayPoints] = useState<DayPoint[]>([]);
  const [compareLabel, setCompareLabel] = useState('');
  const [rangeLabel, setRangeLabel] = useState('');
  const [prevRangeLabel, setPrevRangeLabel] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('quantity');

  const reqRef = useRef(0);

  useEffect(() => { load(); }, [period, customStart, customEnd]);

  async function load() {
    const my = ++reqRef.current;

    if (period === 'custom' && (!customStart || !customEnd || customStart > customEnd)) {
      setRangeError('Chwazi yon dat kòmansman ki anvan (oswa egal) dat fen an.');
      return;
    }
    setRangeError('');
    setLoading(true);

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }
    const bid = ctx.businessId;

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', bid)
      .single();

    const r = getRange(period, customStart, customEnd);
    const startStr = localDate(r.start);
    const endStr = localDate(r.end);
    const prevStartStr = localDate(r.prevStart);
    const prevEndStr = localDate(r.prevEnd);
    const inCur = (day: string | null) => !!day && day >= startStr && day <= endStr;
    const inPrev = (day: string | null) => !!day && day >= prevStartStr && day <= prevEndStr;

    // ===== Pwodwi (pou kou, non, ak stòk) =====
    const prods = await fetchAll<any>((f, t) =>
      supabase
        .from('products')
        .select('id, name, purchase_price, quantity')
        .eq('business_id', bid)
        .order('id')
        .range(f, t)
    );
    const prodMap = new Map<string, any>();
    prods.forEach(p => prodMap.set(p.id, p));

    // ===== Fakti (peryòd anvan an → fen peryòd aktyèl la) =====
    const invoices = await fetchAll<any>((f, t) =>
      supabase
        .from('invoices')
        .select('id, issue_date, total_amount, discount_amount, metadata')
        .eq('business_id', bid)
        .gte('issue_date', prevStartStr)
        .lte('issue_date', endStr)
        .order('id')
        .range(f, t)
    );

    const c: Totals = { ...EMPTY };
    const p: Totals = { ...EMPTY };
    const itemMap = new Map<string, ProductRow>();
    const dayMap = new Map<string, number>();
    const soldIds = new Set<string>();

    invoices.forEach(inv => {
      const day = toLocalDay(inv.issue_date);
      const isCur = inCur(day);
      const isPrev = inPrev(day);
      if (!isCur && !isPrev) return;
      const t = isCur ? c : p;

      const amt = Number(inv.total_amount || 0);
      const disc = Number(inv.discount_amount ?? inv.metadata?.discount ?? 0);
      t.sales += amt;
      t.discount += disc;
      t.count += 1;
      if (isCur && day) dayMap.set(day, (dayMap.get(day) ?? 0) + amt);

      const items = inv.metadata?.items;
      if (!Array.isArray(items)) return;

      const lineTotal = (it: any) =>
        Number(it.total ?? Number(it.quantity || 0) * Number(it.unit_price || 0));
      const itemsSum = items.reduce((s: number, it: any) => s + lineTotal(it), 0);

      items.forEach((it: any) => {
        const qty = Number(it.quantity || 0);
        const gross = lineTotal(it);
        // Distribye rabè a pwopòsyonèlman sou chak atik
        const share = itemsSum > 0 ? gross / itemsSum : 0;
        const rev = Math.max(0, gross - disc * share);

        const prod = it.product_id ? prodMap.get(it.product_id) : null;
        // Si atik la gen pri acha li anrejistre (unit_cost), nou itilize l; sinon pri acha aktyèl la
        const unitCost = it.unit_cost != null ? Number(it.unit_cost) : Number(prod?.purchase_price || 0);
        const itemCost = unitCost * qty;
        t.cost += itemCost;

        if (!isCur) return;
        if (it.product_id) soldIds.add(it.product_id);

        // Gwoupe pa product_id (pa non) pou chanjman non pa divize pwodwi a
        const key = it.product_id ? `p:${it.product_id}` : `n:${it.name || 'San non'}`;
        const name = prod?.name ?? it.name ?? 'San non';
        const row = itemMap.get(key);
        if (row) {
          row.quantity += qty;
          row.revenue += rev;
          row.cost += itemCost;
        } else {
          itemMap.set(key, { key, name, quantity: qty, revenue: rev, cost: itemCost });
        }
      });
    });

    // ===== Depans (filtre pa dat nan rekèt la) =====
    const { data: sampleExp } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', bid)
      .limit(1);
    const sample: any = sampleExp?.[0];
    const dateCol = sample ? ['expense_date', 'date', 'created_at'].find(col => col in sample) : undefined;

    if (dateCol) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(sample[dateCol] ?? ''));
      const expenses = await fetchAll<any>((f, t) => {
        let q = supabase
          .from('expenses')
          .select(`amount, ${dateCol}`)
          .eq('business_id', bid);
        q = isDateOnly
          ? q.gte(dateCol, prevStartStr).lte(dateCol, endStr)
          : q.gte(dateCol, dayStartISO(r.prevStart)).lt(dateCol, nextDayISO(r.end));
        return q.order(dateCol).range(f, t);
      });
      expenses.forEach((e: any) => {
        const d = toLocalDay(e[dateCol]);
        const amt = Number(e.amount || 0);
        if (inCur(d)) c.expenses += amt;
        else if (inPrev(d)) p.expenses += amt;
      });
    }

    // ===== Pèt nan stòk (filtre pa dat nan rekèt la) =====
    const losses = await fetchAll<any>((f, t) =>
      supabase
        .from('stock_adjustments')
        .select('total_cost, created_at')
        .eq('business_id', bid)
        .gte('created_at', dayStartISO(r.prevStart))
        .lt('created_at', nextDayISO(r.end))
        .order('created_at')
        .range(f, t)
    );
    losses.forEach((l: any) => {
      const d = toLocalDay(l.created_at);
      const amt = Number(l.total_cost || 0);
      if (inCur(d)) c.loss += amt;
      else if (inPrev(d)) p.loss += amt;
    });

    // ===== Pwodwi ki pa vann (gen stòk, men 0 vant nan peryòd la) =====
    const dead: DeadRow[] = prods
      .filter(pr => Number(pr.quantity || 0) > 0 && !soldIds.has(pr.id))
      .map(pr => ({
        id: pr.id,
        name: pr.name,
        quantity: Number(pr.quantity),
        value: Number(pr.quantity) * Number(pr.purchase_price || 0),
      }))
      .sort((a, b) => b.value - a.value);

    // ===== Pwen pa jou =====
    const points: DayPoint[] = [];
    for (let d = new Date(r.start); d <= r.end; d = addDays(d, 1)) {
      const iso = localDate(d);
      points.push({ date: iso, label: dayLabel(iso), total: dayMap.get(iso) ?? 0 });
    }

    // Si yon lòt chajman kòmanse pandan tan sa a, inyore rezilta sa yo
    if (my !== reqRef.current) return;

    setCurrency(biz?.currency ?? 'HTG');
    setCur(c);
    setPrev(p);
    setProductRows(Array.from(itemMap.values()));
    setDeadRows(dead);
    setDayPoints(points);
    setCompareLabel(r.compareLabel);
    setRangeLabel(
      startStr === endStr ? fmtDay(r.start) : `${fmtDay(r.start)} – ${fmtDay(r.end)}`
    );
    setPrevRangeLabel(
      prevStartStr === prevEndStr ? fmtDay(r.prevStart) : `${fmtDay(r.prevStart)} – ${fmtDay(r.prevEnd)}`
    );
    setLoading(false);
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const net = (t: Totals) => t.sales - t.cost - t.expenses - t.loss;
  const avgBasket = (t: Totals) => (t.count > 0 ? t.sales / t.count : 0);
  const marginPct = (r: ProductRow) => (r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : null);

  const netProfit = net(cur);
  const prevNetProfit = net(prev);
  const maxDay = Math.max(...dayPoints.map(pt => pt.total), 1);
  const periodLabel = PERIODS.find(pp => pp.value === period)?.label ?? '';

  const sortedProducts = [...productRows].sort((a, b) => {
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    if (sortBy === 'profit') return (b.revenue - b.cost) - (a.revenue - a.cost);
    return b.quantity - a.quantity;
  });
  const topProducts = sortedProducts.slice(0, 15);
  const deadValueTotal = deadRows.reduce((s, d) => s + d.value, 0);

  // ===== Ekspòte Excel (plizyè fèy) =====
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const num = (v: number) => Math.round(Number(v) * 100) / 100;
      const pct = (c: number, p: number) => (p === 0 ? '' : num(((c - p) / Math.abs(p)) * 100));

      // Fèy 1: Rezime + konparezon
      const summaryRows: any[][] = [
        ['RAPÒ BIZMANAGER'],
        ['Peryòd', `${periodLabel} (${rangeLabel})`],
        ['Konpare ak', prevRangeLabel],
        ['Dat rapò a', new Date().toLocaleDateString('fr-HT')],
        ['Devise', currency],
        [],
        ['', 'Peryòd aktyèl', 'Peryòd anvan', 'Chanjman %'],
        ['Vant total', num(cur.sales), num(prev.sales), pct(cur.sales, prev.sales)],
        ['Kantite vant', cur.count, prev.count, pct(cur.count, prev.count)],
        ['Panye mwayen', num(avgBasket(cur)), num(avgBasket(prev)), pct(avgBasket(cur), avgBasket(prev))],
        ['Rabè bay kliyan', num(cur.discount), num(prev.discount), pct(cur.discount, prev.discount)],
        ['Kou pwodwi vann yo', num(cur.cost), num(prev.cost), pct(cur.cost, prev.cost)],
        ['Depans', num(cur.expenses), num(prev.expenses), pct(cur.expenses, prev.expenses)],
        ['Pèt nan stòk', num(cur.loss), num(prev.loss), pct(cur.loss, prev.loss)],
        ['BENEFIS NÈT', num(netProfit), num(prevNetProfit), pct(netProfit, prevNetProfit)],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];

      // Fèy 2: Pèfòmans pwodwi (tout pwodwi vann yo)
      const productSheet: any[][] = [
        ['Pwodwi', 'Kantite vann', 'Revni', 'Kou', 'Benefis', 'Maj %'],
        ...sortedProducts.map(r => {
          const m = marginPct(r);
          return [r.name, num(r.quantity), num(r.revenue), num(r.cost), num(r.revenue - r.cost), m === null ? '' : num(m)];
        }),
      ];
      const wsProducts = XLSX.utils.aoa_to_sheet(productSheet);
      wsProducts['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];

      // Fèy 3: Pwodwi ki pa vann
      const deadSheet: any[][] = [
        ['Pwodwi', 'Kantite an stòk', 'Valè (pri acha)'],
        ...deadRows.map(d => [d.name, d.quantity, num(d.value)]),
      ];
      if (deadRows.length > 0) {
        deadSheet.push([]);
        deadSheet.push(['TOTAL', '', num(deadValueTotal)]);
      }
      const wsDead = XLSX.utils.aoa_to_sheet(deadSheet);
      wsDead['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }];

      // Fèy 4: Vant pa jou
      const daySheet: any[][] = [
        ['Dat', 'Total vant'],
        ...dayPoints.map(pt => [pt.date, num(pt.total)]),
      ];
      const wsDays = XLSX.utils.aoa_to_sheet(daySheet);
      wsDays['!cols'] = [{ wch: 16 }, { wch: 16 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Rezime');
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Pwodwi');
      XLSX.utils.book_append_sheet(wb, wsDead, 'Pa vann');
      XLSX.utils.book_append_sheet(wb, wsDays, 'Vant pa jou');

      XLSX.writeFile(wb, `rapo-bizmanager-${period}-${localDate(new Date())}.xlsx`);
    } catch {
      /* ekspòtasyon pa esansyèl */
    }
    setExporting(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rapò &amp; Statistik</h1>
          <p className="text-sm text-gray-500 mt-1">Analiz vant, benefis, ak pwodwi yo.</p>
        </div>
        <button onClick={exportExcel} disabled={loading || exporting || !!rangeError}
          className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
          {exporting ? 'Ap prepare...' : 'Ekspòte Excel'}
        </button>
      </div>

      {/* Chwazi peryòd */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(pp => (
            <button key={pp.value} onClick={() => setPeriod(pp.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                period === pp.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}>
              {pp.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl p-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block">Soti</label>
              <input type="date" value={customStart} max={customEnd}
                onChange={e => setCustomStart(e.target.value)}
                className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block">Rive</label>
              <input type="date" value={customEnd} min={customStart} max={localDate(new Date())}
                onChange={e => setCustomEnd(e.target.value)}
                className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
        )}

        {rangeError && (
          <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">{rangeError}</div>
        )}

        {!loading && !rangeError && (
          <p className="text-xs text-gray-500">
            Peryòd: <strong className="text-gray-700">{rangeLabel}</strong>
            <span className="text-gray-400"> · konpare ak {prevRangeLabel}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-gray-400 text-sm">Chajman...</div>
      ) : rangeError ? null : (
        <>
          {/* Kat metrik ak konparezon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              label="Vant total"
              value={fmt(cur.sales)}
              sub={`${cur.count} vant`}
              delta={<><Delta cur={cur.sales} prev={prev.sales} /> <span className="text-xs text-gray-400">{compareLabel}</span></>}
            />
            <StatCard
              label="Benefis nèt"
              value={fmt(netProfit)}
              valueClass={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}
              sub="apre kou, depans, pèt"
              delta={<><Delta cur={netProfit} prev={prevNetProfit} /> <span className="text-xs text-gray-400">{compareLabel}</span></>}
            />
            <StatCard
              label="Panye mwayen"
              value={fmt(avgBasket(cur))}
              sub="mwayèn pa vant"
              delta={<><Delta cur={avgBasket(cur)} prev={avgBasket(prev)} /> <span className="text-xs text-gray-400">{compareLabel}</span></>}
            />
            <StatCard
              label="Depans"
              value={fmt(cur.expenses)}
              valueClass="text-orange-600"
              delta={<><Delta cur={cur.expenses} prev={prev.expenses} invert /> <span className="text-xs text-gray-400">{compareLabel}</span></>}
            />
            <StatCard
              label="Pèt nan stòk"
              value={fmt(cur.loss)}
              valueClass="text-red-600"
              delta={<><Delta cur={cur.loss} prev={prev.loss} invert /> <span className="text-xs text-gray-400">{compareLabel}</span></>}
            />
          </div>

          {/* Detay kalkil benefis */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-3">Kijan benefis nèt la kalkile</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vant total (apre rabè)</span>
                <span className="font-medium text-gray-900">{fmt(cur.sales)}</span>
              </div>
              {cur.discount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Rabè bay kliyan yo</span>
                  <span className="text-gray-400">{fmt(cur.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">− Kou pwodwi vann yo</span>
                <span className="font-medium text-gray-700">{fmt(cur.cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">− Depans</span>
                <span className="font-medium text-gray-700">{fmt(cur.expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">− Pèt nan stòk</span>
                <span className="font-medium text-gray-700">{fmt(cur.loss)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                <span className="font-medium text-gray-800">Benefis nèt</span>
                <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Grafik vant pa jou */}
          {dayPoints.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-medium text-gray-800 mb-4">Vant pa jou</h2>
              <div className="flex items-end gap-1 h-40">
                {dayPoints.map(pt => (
                  <div key={pt.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors min-h-[2px]"
                      style={{ height: `${(pt.total / maxDay) * 100}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {pt.label}: {fmt(pt.total)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{dayPoints[0]?.label}</span>
                <span>{dayPoints[dayPoints.length - 1]?.label}</span>
              </div>
            </div>
          )}

          {/* Pèfòmans pwodwi */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="font-medium text-gray-800">Pèfòmans pwodwi ({periodLabel})</h2>
                <p className="text-xs text-gray-400 mt-0.5">Revni yo apre rabè. Maj = benefis ÷ revni.</p>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {([
                  ['quantity', 'Kantite'],
                  ['revenue', 'Revni'],
                  ['profit', 'Benefis'],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <button key={k} onClick={() => setSortBy(k)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
                  <th className="px-4 py-3">Pwodwi</th>
                  <th className="px-4 py-3 text-right">Kantite</th>
                  <th className="px-4 py-3 text-right">Revni</th>
                  <th className="px-4 py-3 text-right">Benefis</th>
                  <th className="px-4 py-3 text-right">Maj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Pa gen vant nan peryòd sa a.
                  </td></tr>
                )}
                {topProducts.map((r, i) => {
                  const profit = r.revenue - r.cost;
                  const m = marginPct(r);
                  return (
                    <tr key={r.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-gray-400 mr-2">{i + 1}.</span>
                        <span className="font-medium">{r.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{r.quantity}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmt(profit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m === null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            m >= 30 ? 'bg-green-100 text-green-700'
                            : m >= 10 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {m.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedProducts.length > topProducts.length && (
              <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
                Montre {topProducts.length} sou {sortedProducts.length} pwodwi. Ekspòte Excel pou wè lis konplè a.
              </p>
            )}
          </div>

          {/* Pwodwi ki pa vann */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Pwodwi ki pa vann ({periodLabel})</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Pwodwi ki gen stòk men ki pa vann ditou nan peryòd la.
                {deadRows.length > 0 && (
                  <> Kòb ki bloke: <strong className="text-orange-600">{fmt(deadValueTotal)}</strong> (pri acha).</>
                )}
              </p>
            </div>
            {deadRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                Tout pwodwi ki an stòk yo vann omwen yon fwa nan peryòd sa a. 👍
              </div>
            ) : (
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
                    <th className="px-4 py-3">Pwodwi</th>
                    <th className="px-4 py-3 text-right">An stòk</th>
                    <th className="px-4 py-3 text-right">Valè (pri acha)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deadRows.slice(0, 15).map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{d.quantity}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmt(d.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {deadRows.length > 15 && (
              <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
                Montre 15 sou {deadRows.length} pwodwi. Ekspòte Excel pou wè lis konplè a.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}