'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Item { name: string; quantity: number; unit_price: number; }
interface Client { id: string; name: string; }
interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  issue_date: string;
  client: { name?: string } | null;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');

 const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, amount_paid, balance_due, status, issue_date, client:clients(name)')
      .eq('business_id', session.user.id)
      .order('created_at', { ascending: false });
    setInvoices((inv as any) ?? []);

    const { data: cl } = await supabase
      .from('clients')
      .select('id, name')
      .eq('business_id', session.user.id)
      .order('name');
    setClients(cl ?? []);

    setLoading(false);
  }

  function updateItem(i: number, field: keyof Item, value: string | number) {
    const copy = [...items];
    (copy[i] as any)[field] = value;
    setItems(copy);
  }

  function addItemRow() {
    setItems([...items, { name: '', quantity: 1, unit_price: 0 }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

 const subtotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  const totalAfterDiscount = Math.max(0, subtotal - discount);

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setMsg('Ajoute omwen yon atik.');
      return;
    }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const rawTotal = validItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
    const finalTotal = Math.max(0, rawTotal - discount);

    const { error } = await supabase.from('invoices').insert({
      business_id: session.user.id,
      client_id: clientId || null,
      niche_template: 'retail',
      issue_date: new Date().toISOString().split('T')[0],
      subtotal: rawTotal,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: finalTotal,
      amount_paid: 0,
      currency: 'HTG',
      status: 'sent',
      metadata: {
        items: validItems.map(it => ({ ...it, total: it.quantity * it.unit_price })),
        discount: discount,
      },
    });

    if (!error) {
      setMsg('Fakti kreye ak siksè!');
      setShowForm(false);
      setClientId('');
      setItems([{ name: '', quantity: 1, unit_price: 0 }]);
      setDiscount(0);
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-HT').format(n ?? 0) + ' HTG';

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Factures</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Fèmen' : '+ Nouvo fakti'}
        </button>
      </div>

      {msg && (
        <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>
      )}

      {showForm && (
        <form onSubmit={saveInvoice} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Kliyan</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">— Chwazi kliyan —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Atik yo</label>
            <div className="space-y-2 mt-1">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Non atik" value={it.name}
                    onChange={e => updateItem(i, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="number" placeholder="Qté" value={it.quantity}
                    onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="number" placeholder="Pri" value={it.unit_price}
                    onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm" />
                  <span className="w-24 text-sm text-gray-600 text-right">{fmt(it.quantity * it.unit_price)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-red-500 text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow}
              className="mt-2 text-sm text-blue-600 hover:underline">+ Ajoute atik</button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Sou-total:</span>
              <span className="text-sm font-medium w-28 text-right">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Rabè (HTG):</span>
              <input type="number" value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right" />
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-semibold w-28 text-right">{fmt(totalAfterDiscount)}</span>
            </div>
          </div>

          <button type="submit"
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            Anrejistre fakti a
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Numewo</th>
              <th className="px-4 py-3">Kliyan</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Solde</th>
              <th className="px-4 py-3">Estati</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Pa gen fakti toujou.</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
<td className="px-4 py-3 font-mono text-blue-600 text-xs">
  <a href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</a>
</td>
                <td className="px-4 py-3">{inv.client?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(inv.issue_date).toLocaleDateString('fr-HT')}</td>
                <td className="px-4 py-3">{fmt(inv.total_amount)}</td>
                <td className="px-4 py-3">
                  {inv.balance_due > 0
                    ? <span className="text-orange-600">{fmt(inv.balance_due)}</span>
                    : <span className="text-green-600">Soldé</span>}
                </td>
                <td className="px-4 py-3">
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