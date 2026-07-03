'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, currencySymbol } from '@/lib/currency';

interface Item {
  name: string;
  quantity: number;
  unit_price: number;
  product_id?: string | null;
}
interface Client { id: string; name: string; }
interface Product { id: string; name: string; sale_price: number; quantity: number; }
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('HTG');

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: 1, unit_price: 0, product_id: null }]);
  const [discount, setDiscount] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', session.user.id)
      .single();
    setCurrency(biz?.currency ?? 'HTG');

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

    const { data: pr } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity')
      .eq('business_id', session.user.id)
      .order('name');
    setProducts(pr ?? []);

    setLoading(false);
  }

  function updateItem(i: number, field: keyof Item, value: string | number) {
    const copy = [...items];
    (copy[i] as any)[field] = value;
    setItems(copy);
  }

  function selectProduct(i: number, productId: string) {
    const copy = [...items];
    if (productId === '') {
      copy[i].product_id = null;
      setItems(copy);
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (prod) {
      copy[i].product_id = prod.id;
      copy[i].name = prod.name;
      copy[i].unit_price = prod.sale_price;
    }
    setItems(copy);
  }

  function addItemRow() {
    setItems([...items, { name: '', quantity: 1, unit_price: 0, product_id: null }]);
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

    for (const it of validItems) {
      if (it.product_id) {
        const prod = products.find(p => p.id === it.product_id);
        if (prod && it.quantity > prod.quantity) {
          setMsg(`Stock pa ase pou "${prod.name}". Ou gen ${prod.quantity} an stock, ou eseye vann ${it.quantity}.`);
          return;
        }
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

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
      currency: currency,
      status: 'sent',
      metadata: {
        items: validItems.map(it => ({
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total: it.quantity * it.unit_price,
          product_id: it.product_id ?? null,
        })),
        discount: discount,
      },
    });

    if (error) {
      setMsg('Erè: ' + error.message);
      setSaving(false);
      return;
    }

    for (const it of validItems) {
      if (it.product_id) {
        const prod = products.find(p => p.id === it.product_id);
        if (prod) {
          await supabase
            .from('products')
            .update({ quantity: prod.quantity - it.quantity })
            .eq('id', it.product_id);
        }
      }
    }

    setMsg('Fakti kreye ak siksè!');
    setShowForm(false);
    setClientId('');
    setItems([{ name: '', quantity: 1, unit_price: 0, product_id: null }]);
    setDiscount(0);
    load();
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const sym = currencySymbol(currency);

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
        <div className={`text-sm rounded-lg p-3 ${msg.startsWith('Erè') || msg.startsWith('Stock') || msg.startsWith('Ajoute') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
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
            <p className="text-xs text-gray-400 mb-2">Chwazi yon pwodwi nan envantè a, oswa tape yon atik lib. (Pri an {sym})</p>
            <div className="space-y-3 mt-1">
              {items.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                  {products.length > 0 && (
                    <select value={it.product_id ?? ''} onChange={e => selectProduct(i, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">— Atik lib (tape anba) —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                          {p.name} ({p.quantity} an stock) {p.quantity <= 0 ? '- FINI' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 items-center">
                    <input placeholder="Non atik" value={it.name}
                      onChange={e => updateItem(i, 'name', e.target.value)}
                      readOnly={!!it.product_id}
                      className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <input type="number" placeholder="Qté" value={it.quantity === 0 ? '' : it.quantity} min="1"
                      onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    <input type="number" placeholder="Pri" value={it.unit_price === 0 ? '' : it.unit_price}
                      onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      readOnly={!!it.product_id}
                      className={`w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <span className="w-24 text-sm text-gray-600 text-right">{fmt(it.quantity * it.unit_price)}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="text-red-500 text-sm px-2">✕</button>
                    )}
                  </div>
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
              <span className="text-sm text-gray-500">Rabè ({sym}):</span>
              <input type="number" value={discount === 0 ? '' : discount} placeholder="0"
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right" />
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-semibold w-28 text-right">{fmt(totalAfterDiscount)}</span>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Ap anrejistre...' : 'Anrejistre fakti a'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
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