'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

interface SoldItem {
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
}

interface DayPoint {
  date: string;   // YYYY-MM-DD
  label: string;  // JJ/MM
  total: number;
}

const PERIODS = [
  { value: 'today', label: 'Jodi a', days: 0 },
  { value: '7', label: '7 jou', days: 6 },
  { value: '30', label: '30 jou', days: 29 },
];

// Dat lokal an YYYY-MM-DD
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('today');
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);

  const [totalSales, setTotalSales] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [topItems, setTopItems] = useState<SoldItem[]>([]);
  const [dayPoints, setDayPoints] = useState<DayPoint[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', ctx.businessId)
      .single();
    setCurrency(biz?.currency ?? 'HTG');

    const cfg = PERIODS.find(p => p.value === period) ?? PERIODS[0];
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - cfg.days);
    const startStr = localDate(start);
    const endStr = localDate(end);

    const inPeriod = (day: string | null) =>
      !!day && day >= startStr && day <= endStr;

    // Pri acha pwodwi yo (pou kalkile kou)
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, purchase_price')
      .eq('business_id', ctx.businessId);
    const costMap = new Map<string, number>();
    (prods ?? []).forEach((p: any) => costMap.set(p.id, Number(p.purchase_price || 0)));

    // Fakti nan peryòd la
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, issue_date, total_amount, discount_amount, metadata')
      .eq('business_id', ctx.businessId)
      .gte('issue_date', startStr)
      .lte('issue_date', endStr);

    let sales = 0;
    let cost = 0;
    let discountSum = 0;
    const itemMap = new Map<string, SoldItem>();
    const dayMap = new Map<string, number>();

    (invoices ?? []).forEach((inv: any) => {
      const amt = Number(inv.total_amount || 0);
      sales += amt;
      dayMap.set(inv.issue_date, (dayMap.get(inv.issue_date) ?? 0) + amt);

      const discAmount = Number(
        inv.discount_amount ?? inv.metadata?.discount ?? 0
      );
      discountSum += discAmount;

      const items = inv.metadata?.items;
      if (Array.isArray(items)) {
        const itemsSum = items.reduce(
          (s: number, it: any) => s + Number(it.total || 0), 0
        );

        items.forEach((it: any) => {
          const qty = Number(it.quantity || 0);
          const gross = Number(it.total || 0);

          // Distribye rabè a pwopòsyonèlman sou chak atik
          const share = itemsSum > 0 ? gross / itemsSum : 0;
          const rev = Math.max(0, gross - discAmount * share);

          const unitCost = it.product_id ? (costMap.get(it.product_id) ?? 0) : 0;
          const itemCost = unitCost * qty;
          cost += itemCost;

          const key = it.name || 'San non';
          const prev = itemMap.get(key);
          if (prev) {
            prev.quantity += qty;
            prev.revenue += rev;
            prev.cost += itemCost;
          } else {
            itemMap.set(key, { name: key, quantity: qty, revenue: rev, cost: itemCost });
          }
        });
      }
    });

    setTotalSales(sales);
    setTotalCost(cost);
    setTotalDiscount(discountSum);
    setSaleCount((invoices ?? []).length);

    setTopItems(
      Array.from(itemMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)
    );

    const points: DayPoint[] = [];
    for (let i = cfg.days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = localDate(d);
      points.push({ date: iso, label: dayLabel(iso), total: dayMap.get(iso) ?? 0 });
    }
    setDayPoints(points);

    // ===== Depans =====
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', ctx.businessId)
      .limit(2000);

    let expenses = 0;
    if (allExpenses && allExpenses.length > 0) {
      const sample: any = allExpenses[0];
      const dateCol = ['expense_date', 'date', 'created_at'].find(c => c in sample);
      if (dateCol) {
        expenses = allExpenses.reduce((s: number, e: any) => {
          return inPeriod(toLocalDay(e[dateCol])) ? s + Number(e.amount || 0) : s;
        }, 0);
      }
    }
    setTotalExpenses(expenses);

    // ===== Pèt nan stock =====
    const { data: losses } = await supabase
      .from('stock_adjustments')
      .select('total_cost, created_at')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false })
      .limit(2000);

    const lossTotal = (losses ?? []).reduce((s: number, l: any) => {
      return inPeriod(toLocalDay(l.created_at)) ? s + Number(l.total_cost || 0) : s;
    }, 0);
    setTotalLoss(lossTotal);

    setLoading(false);
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const netProfit = totalSales - totalCost - totalExpenses - totalLoss;
  const maxDay = Math.max(...dayPoints.map(p => p.total), 1);
  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? '';

  // Ekspòte yon vrè fichye Excel ak plizyè fèy
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const num = (v: number) => Math.round(Number(v) * 100) / 100;

      // ===== FÈY 1: Rezime =====
      const summaryRows: any[][] = [
        ['RAPÒ BIZMANAGER'],
        ['Peryòd', periodLabel],
        ['Dat rapò a', new Date().toLocaleDateString('fr-HT')],
        ['Devise', currency],
        [],
        ['REZIME FINANSYE'],
        ['Vant total', num(totalSales)],
        ['Rabè bay kliyan', num(totalDiscount)],
        ['Kou pwodwi vann yo', num(totalCost)],
        ['Depans', num(totalExpenses)],
        ['Pèt nan stock', num(totalLoss)],
        ['BENEFIS NÈT', num(netProfit)],
        [],
        ['Kantite vant', saleCount],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 26 }, { wch: 18 }];

      // ===== FÈY 2: Top pwodwi =====
      const productRows: any[][] = [
        ['Pwodwi', 'Kantite vann', 'Revni', 'Kou', 'Benefis'],
        ...topItems.map(it => [
          it.name,
          num(it.quantity),
          num(it.revenue),
          num(it.cost),
          num(it.revenue - it.cost),
        ]),
      ];

      if (topItems.length > 0) {
        productRows.push([]);
        productRows.push([
          'TOTAL',
          num(topItems.reduce((s, it) => s + it.quantity, 0)),
          num(topItems.reduce((s, it) => s + it.revenue, 0)),
          num(topItems.reduce((s, it) => s + it.cost, 0)),
          num(topItems.reduce((s, it) => s + (it.revenue - it.cost), 0)),
        ]);
      }

      const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
      wsProducts['!cols'] = [
        { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];

      // ===== FÈY 3: Vant pa jou =====
      const dayRows: any[][] = [
        ['Dat', 'Total vant'],
        ...dayPoints.map(p => [p.date, num(p.total)]),
      ];

      if (dayPoints.length > 0) {
        dayRows.push([]);
        dayRows.push(['TOTAL', num(dayPoints.reduce((s, p) => s + p.total, 0))]);
      }

      const wsDays = XLSX.utils.aoa_to_sheet(dayRows);
      wsDays['!cols'] = [{ wch: 16 }, { wch: 16 }];

      // ===== Bati klasè a =====
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Rezime');
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Top pwodwi');
      XLSX.utils.book_append_sheet(wb, wsDays, 'Vant pa jou');

      XLSX.writeFile(wb, `rapo-bizmanager-${period}-${localDate(new Date())}.xlsx`);
    } catch (e) {
      /* inyore — ekspòtasyon pa esansyèl */
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
        <button onClick={exportExcel} disabled={loading || exporting}
          className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
          {exporting ? 'Ap prepare...' : 'Ekspòte Excel'}
        </button>
      </div>

      {/* Chwazi peryòd */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-6 text-gray-400 text-sm">Chajman...</div>
      ) : (
        <>
          {/* Kat metrik */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Vant total</p>
              <p className="text-xl font-semibold mt-1 text-gray-900">{fmt(totalSales)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{saleCount} vant</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Benefis nèt</p>
              <p className={`text-xl font-semibold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(netProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">apre kou, depans, pèt</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Depans</p>
              <p className="text-xl font-semibold mt-1 text-orange-600">{fmt(totalExpenses)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pèt nan stock</p>
              <p className="text-xl font-semibold mt-1 text-red-600">{fmt(totalLoss)}</p>
            </div>
          </div>

          {/* Detay kalkil benefis */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-3">Kijan benefis nèt la kalkile</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vant total (apre rabè)</span>
                <span className="font-medium text-gray-900">{fmt(totalSales)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Rabè bay kliyan yo</span>
                  <span className="text-gray-400">{fmt(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">− Kou pwodwi vann yo</span>
                <span className="font-medium text-gray-700">{fmt(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">− Depans</span>
                <span className="font-medium text-gray-700">{fmt(totalExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">− Pèt nan stock</span>
                <span className="font-medium text-gray-700">{fmt(totalLoss)}</span>
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
          {period !== 'today' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-medium text-gray-800 mb-4">Vant pa jou</h2>
              <div className="flex items-end gap-1 h-40">
                {dayPoints.map(p => (
                  <div key={p.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors min-h-[2px]"
                      style={{ height: `${(p.total / maxDay) * 100}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {p.label}: {fmt(p.total)}
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

          {/* Top pwodwi */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">Pwodwi ki pi vann ({periodLabel})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Revni yo apre rabè.</p>
            </div>
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
                  <th className="px-4 py-3">Pwodwi</th>
                  <th className="px-4 py-3 text-right">Kantite</th>
                  <th className="px-4 py-3 text-right">Revni</th>
                  <th className="px-4 py-3 text-right">Benefis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topItems.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Pa gen vant nan peryòd sa a.
                  </td></tr>
                )}
                {topItems.map((it, i) => (
                  <tr key={it.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-gray-400 mr-2">{i + 1}.</span>
                      <span className="font-medium">{it.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{it.quantity}</td>
                    <td className="px-4 py-3 text-right">{fmt(it.revenue)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {fmt(it.revenue - it.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}