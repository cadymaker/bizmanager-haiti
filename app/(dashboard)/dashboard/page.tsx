'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatMoney } from '@/lib/currency';

interface Metrics {
  total_sales: number;
  total_cash_received: number;
  total_investments: number;
  total_expenses: number;
  total_stock_value: number;
  total_stock_cost: number;
  total_cogs: number;
  total_stock_loss: number;
  total_discount: number;
  net_profit: number;
  total_receivables: number;
}

export default function DashboardPage() {
  const [ownerName, setOwnerName] = useState('');
  const [currency, setCurrency] = useState('HTG');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [invoices, setInvoices] = useState<{
    id: string;
    invoice_number: string;
    total_amount: number;
    balance_due: number;
    status: string;
    client: { name?: string } | null;
  }[]>([]);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const ctx = await getBusinessContext();
      if (!ctx) return;

      const { data: business } = await supabase
        .from('businesses')
        .select('owner_name, currency, trial_start_date, license_status')
        .eq('id', ctx.businessId)
        .single();

      if (business) {
        setOwnerName(business.owner_name);
        setCurrency(business.currency ?? 'HTG');
        if (business.license_status === 'trial') {
          const start = new Date(business.trial_start_date);
          const end = new Date(start);
          end.setDate(end.getDate() + 14);
          setTrialDays(Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)));
        }
      }

      const { data: m } = await supabase
        .from('dashboard_metrics')
        .select('*')
        .eq('business_id', ctx.businessId)
        .single();
      setMetrics(m as any);

      const { data: inv } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, balance_due, status, client:clients(name)')
        .eq('business_id', ctx.businessId)
        .order('created_at', { ascending: false })
        .limit(5);
      setInvoices((inv as any) ?? []);
    }
    load();
  }, []);

  const fmt = (n: number) => formatMoney(n, currency);

  const sales = metrics?.total_sales ?? 0;
  const cogs = metrics?.total_cogs ?? 0;
  const expenses = metrics?.total_expenses ?? 0;
  const stockLoss = metrics?.total_stock_loss ?? 0;
  const netProfit = metrics?.net_profit ?? 0;

  return (
    <div className="p-6 space-y-6">
      {trialDays !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-center justify-between">
          <span>Esè gratis — <strong>{trialDays} jou rete.</strong></span>
          <a href="/subscribe" className="underline font-medium">Achte lisans →</a>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tablo de bòd</h1>
        <p className="text-sm text-gray-500 mt-1">Byenveni, {ownerName}</p>
      </div>

      {/* Kat metrik yo */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total vant</p>
          <p className="text-lg sm:text-xl font-semibold mt-1">{fmt(sales)}</p>
          <p className="text-xs text-gray-400 mt-1">Valè total tout fakti yo</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Kach resevwa</p>
          <p className="text-lg sm:text-xl font-semibold mt-1 text-green-600">{fmt(metrics?.total_cash_received ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Lajan ki peye reyèlman</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Valè stock (vant)</p>
          <p className="text-lg sm:text-xl font-semibold mt-1 text-blue-600">{fmt(metrics?.total_stock_value ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">
            Kou: {fmt(metrics?.total_stock_cost ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Envestisman</p>
          <p className="text-lg sm:text-xl font-semibold mt-1">{fmt(metrics?.total_investments ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Acha machandiz/kapital</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Depans</p>
          <p className="text-lg sm:text-xl font-semibold mt-1 text-orange-600">{fmt(expenses)}</p>
          <p className="text-xs text-gray-400 mt-1">Lwaye, salè, transpò...</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Benefis nèt</p>
          <p className={`text-lg sm:text-xl font-semibold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(netProfit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Apre kou, depans, ak pèt</p>
        </div>
      </div>

      {/* Bannè Dèt kliyan */}
      {(metrics?.total_receivables ?? 0) > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm flex justify-between items-center">
          <span>Dèt kliyan: <strong>{fmt(metrics?.total_receivables ?? 0)}</strong></span>
          <a href="/clients" className="underline font-medium">Wè kliyan →</a>
        </div>
      )}

      {/* Detay kalkil benefis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-3">Kijan benefis nèt la kalkile</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Vant total (apre rabè)</span>
            <span className="font-medium text-gray-900">{fmt(sales)}</span>
          </div>
          {(metrics?.total_discount ?? 0) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Rabè bay kliyan yo</span>
              <span className="text-gray-400">{fmt(metrics?.total_discount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">− Kou pwodwi vann yo</span>
            <span className="font-medium text-gray-700">{fmt(cogs)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">− Depans</span>
            <span className="font-medium text-gray-700">{fmt(expenses)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">− Pèt nan stock</span>
            <span className="font-medium text-gray-700">{fmt(stockLoss)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
            <span className="font-medium text-gray-800">Benefis nèt</span>
            <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(netProfit)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Envestisman (acha machandiz, kapital) pa antre nan kalkil sa a — acha machandiz konte
          kòm kou lè pwodwi a vann.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium text-gray-800 mb-4">Rezime finansye</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart
              data={[
                { name: 'Vant', valè: sales },
                { name: 'Kou pwodwi', valè: cogs },
                { name: 'Depans', valè: expenses },
                { name: 'Benefis', valè: netProfit },
              ]}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={70}
                tickFormatter={(v) => new Intl.NumberFormat('fr-HT', { notation: 'compact' }).format(v)} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={false} />
              <Bar dataKey="valè" radius={[6, 6, 0, 0]}>
                {[
                  '#16a34a', '#6b7280', '#dc2626',
                  netProfit >= 0 ? '#2563eb' : '#dc2626',
                ].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-medium text-gray-800">Fakti resan</h2>
          <a href="/invoices" className="text-sm text-blue-600 hover:underline">Wè tout →</a>
        </div>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-2">Nimewo</th>
              <th className="px-4 py-2">Kliyan</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Balans</th>
              <th className="px-4 py-2">Estati</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Pa gen fakti toujou.</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-blue-600 text-xs">
                  <a href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</a>
                </td>
                <td className="px-4 py-2">{inv.client?.name ?? '—'}</td>
                <td className="px-4 py-2">{fmt(inv.total_amount)}</td>
                <td className="px-4 py-2">
                  {inv.balance_due > 0
                    ? <span className="text-orange-600">{fmt(inv.balance_due)}</span>
                    : <span className="text-green-600">Peye nèt</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'partial' ? 'bg-orange-100 text-orange-700' :
                    inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{
                    inv.status === 'paid' ? 'Peye' :
                    inv.status === 'partial' ? 'Pasyèl' :
                    inv.status === 'sent' ? 'Voye' :
                    inv.status === 'draft' ? 'Bouyon' :
                    inv.status === 'cancelled' ? 'Anile' : inv.status
                  }</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}