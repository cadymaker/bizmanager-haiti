'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

interface LogRow {
  id: number;
  actor_name: string | null;
  table_name: string;
  record_id: string | null;
  record_label: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changes: any;
  created_at: string;
}

const PAGE_SIZE = 50;

const TABLE_LABELS: Record<string, string> = {
  invoices: 'Fakti',
  payments: 'Peman',
  products: 'Pwodwi',
  expenses: 'Depans',
  clients: 'Kliyan',
  investments: 'Envestisman',
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Kreye',
  UPDATE: 'Modifye',
  DELETE: 'Efase',
};

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Non',
  sale_price: 'Pri vant',
  purchase_price: 'Pri acha',
  quantity: 'Kantite',
  barcode: 'Barcode',
  low_stock_threshold: 'Alèt stòk',
  image_url: 'Foto',
  total_amount: 'Total',
  subtotal: 'Sou-total',
  amount_paid: 'Montan peye',
  status: 'Estati',
  client_id: 'Kliyan',
  discount_amount: 'Rabè',
  discount_value: 'Valè rabè',
  discount_type: 'Tip rabè',
  promo_code: 'Kòd promo',
  issue_date: 'Dat',
  metadata: 'Atik yo',
  amount: 'Montan',
  method: 'Metòd',
  description: 'Deskripsyon',
  category: 'Kategori',
  expense_date: 'Dat',
  date: 'Dat',
  note: 'Nòt',
  notes: 'Nòt',
  phone: 'Telefòn',
  address: 'Adrès',
  email: 'Imèl',
  type: 'Tip',
};

// Chan teknik nou pa montre
const HIDDEN = new Set([
  'id', 'business_id', 'created_at', 'updated_at', 'created_by', 'session_id',
  'niche_template', 'source', 'tax_rate', 'tax_amount', 'currency', 'balance_due',
  'invoice_id', 'product_id', 'invoice_number', 'opened_by', 'closed_by',
]);

const MONEY = new Set([
  'sale_price', 'purchase_price', 'total_amount', 'subtotal', 'amount_paid',
  'discount_amount', 'amount',
]);

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bouyon',
  sent: 'Voye',
  partial: 'Pasyèl',
  paid: 'Peye',
  cancelled: 'Anile',
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AuditPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [denied, setDenied] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => { load(true); }, [tableFilter, actionFilter]);

  async function load(reset: boolean) {
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }
    if (ctx.role === 'cashier') { setDenied(true); setLoading(false); return; }

    if (reset) {
      setLoading(true);
      setExpanded(new Set());
      const { data: biz } = await supabase
        .from('businesses').select('currency').eq('id', ctx.businessId).single();
      setCurrency(biz?.currency ?? 'HTG');
    } else {
      setLoadingMore(true);
    }

    const offset = reset ? 0 : rows.length;
    let q = supabase
      .from('audit_log')
      .select('id, actor_name, table_name, record_id, record_label, action, changes, created_at')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (tableFilter) q = q.eq('table_name', tableFilter);
    if (actionFilter) q = q.eq('action', actionFilter);

    const { data } = await q;
    const list = (data ?? []) as LogRow[];
    setRows(reset ? list : [...rows, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const fmt = (n: number) => formatMoney(n, currency);

  function fmtVal(key: string, v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (MONEY.has(key)) return fmt(Number(v));
    if (key === 'status') return STATUS_LABELS[String(v)] ?? String(v);
    if (key === 'metadata') {
      const n = Array.isArray(v?.items) ? v.items.length : 0;
      return `${n} atik`;
    }
    if (key === 'client_id') return 'chanje';
    if (key === 'image_url') return 'foto';
    if (typeof v === 'boolean') return v ? 'Wi' : 'Non';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function rowTitle(r: LogRow): string {
    const action = ACTION_LABELS[r.action] ?? r.action;
    const table = (TABLE_LABELS[r.table_name] ?? r.table_name).toLowerCase();
    let label = r.record_label ?? '';
    if (!label && r.table_name === 'payments') {
      const amt = r.action === 'UPDATE' ? r.changes?.amount?.new ?? r.changes?.amount?.old : r.changes?.amount;
      if (amt != null) label = fmt(Number(amt));
    }
    return `${action} ${table}${label ? ` — ${label}` : ''}`;
  }

  function detailLines(r: LogRow): { label: string; text: string }[] {
    const c = r.changes ?? {};
    if (r.action === 'UPDATE') {
      return Object.keys(c)
        .filter(k => !HIDDEN.has(k))
        .map(k => {
          if (k === 'metadata') return { label: FIELD_LABELS[k] ?? k, text: 'Atik fakti yo modifye' };
          return {
            label: FIELD_LABELS[k] ?? k,
            text: `${fmtVal(k, c[k]?.old)} → ${fmtVal(k, c[k]?.new)}`,
          };
        });
    }
    // INSERT / DELETE: montre valè enpòtan yo
    return Object.keys(c)
      .filter(k => !HIDDEN.has(k) && c[k] !== null && c[k] !== '' && FIELD_LABELS[k])
      .map(k => ({ label: FIELD_LABELS[k], text: fmtVal(k, c[k]) }));
  }

  if (denied) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">Aksè refize — se mèt biznis la sèlman ki ka wè istwa a.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Istwa aktivite</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tout modifikasyon ak efasman sou fakti, peman, pwodwi, depans, kliyan, ak envestisman — kiyès ki fè l, ak kilè.
        </p>
      </div>

      {/* Filtè */}
      <div className="flex flex-wrap gap-3">
        <select value={tableFilter} onChange={e => setTableFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Tout kategori</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">Tout aksyon</option>
          <option value="INSERT">Kreyasyon</option>
          <option value="UPDATE">Modifikasyon</option>
          <option value="DELETE">Efasman</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm p-4">Chajman...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Pa gen aktivite pou kounye a.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {rows.map(r => {
            const lines = detailLines(r);
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id} className="px-4 py-3">
                <button onClick={() => lines.length > 0 && toggle(r.id)}
                  className="w-full flex items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLES[r.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABELS[r.action] ?? r.action}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">{rowTitle(r)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {r.actor_name ?? 'Itilizatè'} · {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                  {lines.length > 0 && (
                    <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {isOpen && lines.length > 0 && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-1">
                    {lines.map((l, i) => (
                      <div key={i} className="flex justify-between gap-4 text-xs">
                        <span className="text-gray-500">{l.label}</span>
                        <span className="text-gray-800 text-right break-all">{l.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <button onClick={() => load(false)} disabled={loadingMore}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
          {loadingMore ? 'Ap chaje...' : 'Chaje plis'}
        </button>
      )}
    </div>
  );
}