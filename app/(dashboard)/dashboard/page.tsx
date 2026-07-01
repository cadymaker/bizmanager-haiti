'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [ownerName, setOwnerName] = useState('');
  const [metrics, setMetrics] = useState<{
    total_sales: number;
    total_investments: number;
    total_expenses: number;
    net_profit: number;
    total_receivables: number;
  } | null>(null);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: business } = await supabase
        .from('businesses')
        .select('owner_name, trial_start_date, license_status')
        .eq('id', session.user.id)
        .single();

      if (business) {
        setOwnerName(business.owner_name);
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
        .eq('business_id', session.user.id)
        .single();
      setMetrics(m);

      const { data: inv } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, balance_due, status, client:clients(name)')
        .eq('business_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setInvoices((inv as any) ?? []);
    }
    load();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('fr-HT').format(n ?? 0) + ' HTG';

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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total ventes</p>
          <p className="text-xl font-semibold mt-1">{fmt(metrics?.total_sales ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Investisman</p>
          <p className="text-xl font-semibold mt-1">{fmt(metrics?.total_investments ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Depans</p>
          <p className="text-xl font-semibold mt-1">{fmt(metrics?.total_expenses ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Benefis net</p>
          <p className={`text-xl font-semibold mt-1 ${(metrics?.net_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(metrics?.net_profit ?? 0)}
          </p>
        </div>
      </div>

      {(metrics?.total_receivables ?? 0) > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm flex justify-between">
          <span>Dèt kliyan: <strong>{fmt(metrics?.total_receivables ?? 0)}</strong></span>
          <a href="/clients" className="underline">Wè kliyan →</a>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-medium text-gray-800">Factures resan</h2>
          <a href="/invoices" className="text-sm text-blue-600 hover:underline">Wè tout →</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-2">Numewo</th>
              <th className="px-4 py-2">Kliyan</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Solde</th>
              <th className="px-4 py-2">Estati</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Pa gen factures toujou.</td></tr>
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
                    : <span className="text-green-600">Soldé</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'partial' ? 'bg-orange-100 text-orange-700' :
                    inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}