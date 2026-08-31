'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

const CATEGORIES = [
  { value: 'lwaye', label: 'Lwaye' },
  { value: 'elektrisite', label: 'Elektrisite' },
  { value: 'eau', label: 'Dlo' },
  { value: 'salaire', label: 'Salè' },
  { value: 'transport', label: 'Transpò' },
  { value: 'autre', label: 'Lòt' },
];

const INV_TYPES = [
  { value: 'merchandise', label: 'Acha machandiz' },
  { value: 'capital', label: 'Kapital / Ekipman' },
];

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
}
interface Investment {
  id: string;
  description: string | null;
  amount: number;
  type: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [currency, setCurrency] = useState('HTG');

  const [expForm, setExpForm] = useState({ category: 'lwaye', description: '', amount: '' });
  const [invForm, setInvForm] = useState({ description: '', amount: '', type: 'merchandise' });

  const [editExpId, setEditExpId] = useState<string | null>(null);
  const [editInvId, setEditInvId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: bizCur } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', ctx.businessId)
      .single();
    setCurrency(bizCur?.currency ?? 'HTG');

    const { data: exp } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });
    setExpenses((exp as any) ?? []);

    const { data: inv } = await supabase
      .from('investments')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });
    setInvestments((inv as any) ?? []);

    setLoading(false);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(expForm.amount);
    if (!amt || amt <= 0) { setMsg('Antre yon montan valid.'); return; }

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) return;

    const payload = {
      business_id: ctx.businessId,
      category: expForm.category,
      description: expForm.description || null,
      amount: amt,
    };

    let error;
    if (editExpId) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', editExpId));
    } else {
      ({ error } = await supabase.from('expenses').insert(payload));
    }

    if (!error) {
      setMsg(editExpId ? 'Depans modifye!' : 'Depans anrejistre!');
      setExpForm({ category: 'lwaye', description: '', amount: '' });
      setEditExpId(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  async function saveInvestment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(invForm.amount);
    if (!amt || amt <= 0) { setMsg('Antre yon montan valid.'); return; }

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) return;

    const payload = {
      business_id: ctx.businessId,
      description: invForm.description || null,
      amount: amt,
      type: invForm.type,
    };

    let error;
    if (editInvId) {
      ({ error } = await supabase.from('investments').update(payload).eq('id', editInvId));
    } else {
      ({ error } = await supabase.from('investments').insert(payload));
    }

    if (!error) {
      setMsg(editInvId ? 'Envestisman modifye!' : 'Envestisman anrejistre!');
      setInvForm({ description: '', amount: '', type: 'merchandise' });
      setEditInvId(null);
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  function startEditExpense(x: Expense) {
    setExpForm({ category: x.category, description: x.description ?? '', amount: String(x.amount) });
    setEditExpId(x.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditInvestment(x: Investment) {
    setInvForm({
      description: x.description ?? '',
      amount: String(x.amount),
      type: x.type ?? 'merchandise',
    });
    setEditInvId(x.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteExpense(id: string) {
    if (!confirm('Efase depans sa a?')) return;
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    load();
  }

  async function deleteInvestment(id: string) {
    if (!confirm('Efase envestisman sa a?')) return;
    const supabase = createClient();
    await supabase.from('investments').delete().eq('id', id);
    load();
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;
  const typeLabel = (v: string) => INV_TYPES.find(t => t.value === v)?.label ?? v;

  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const totalInvestments = investments.reduce((s, x) => s + x.amount, 0);
  const totalMerchandise = investments
    .filter(x => (x.type ?? 'merchandise') === 'merchandise')
    .reduce((s, x) => s + x.amount, 0);
  const totalCapital = investments
    .filter(x => x.type === 'capital')
    .reduce((s, x) => s + x.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Depans &amp; Envestisman</h1>

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.startsWith('Erè') || msg.startsWith('Antre') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DEPANS */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-1">{editExpId ? 'Modifye depans' : 'Ajoute yon depans'}</h2>
            <p className="text-xs text-gray-400 mb-3">Depans ki antre nan kalkil benefis la.</p>
            <form onSubmit={saveExpense} className="space-y-3">
              <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input placeholder="Deskripsyon (opsyonèl)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} />
              <input type="number" placeholder="Montan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit"
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  {editExpId ? 'Anrejistre chanjman' : 'Anrejistre depans'}
                </button>
                {editExpId && (
                  <button type="button" onClick={() => { setEditExpId(null); setExpForm({ category: 'lwaye', description: '', amount: '' }); }}
                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                    Anile
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Depans yo</h3>
              <span className="text-red-600 font-semibold text-sm">{fmt(totalExpenses)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {loading && <div className="px-4 py-6 text-center text-gray-400 text-sm">Chajman...</div>}
              {!loading && expenses.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">Pa gen depans toujou.</div>
              )}
              {expenses.map(x => (
                <div key={x.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-800">{catLabel(x.category)}</div>
                    {x.description && <div className="text-xs text-gray-400 truncate">{x.description}</div>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700">{fmt(x.amount)}</span>
                    <button onClick={() => startEditExpense(x)}
                      className="text-xs text-blue-600 hover:underline">Modifye</button>
                    <button onClick={() => deleteExpense(x.id)}
                      className="text-xs text-red-600 hover:underline">Efase</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ENVESTISMAN */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-1">{editInvId ? 'Modifye envestisman' : 'Ajoute yon envestisman'}</h2>
            <p className="text-xs text-gray-400 mb-3">
              Lajan ou mete nan biznis la. Sa pa antre nan kalkil benefis la.
            </p>
            <form onSubmit={saveInvestment} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Kalite envestisman</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {INV_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setInvForm({ ...invForm, type: t.value })}
                      className={`py-2 rounded-lg text-sm font-medium border ${
                        invForm.type === t.value
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {invForm.type === 'merchandise'
                    ? 'Stòk ou achte pou revann. Li tounen kou lè pwodwi a vann.'
                    : 'Ekipman, mèb, enstalasyon — bagay ki rete nan biznis la.'}
                </p>
              </div>
              <input placeholder={invForm.type === 'merchandise' ? 'Ex: Acha stòk Whey' : 'Ex: Frijidè'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={invForm.description} onChange={e => setInvForm({ ...invForm, description: e.target.value })} />
              <input type="number" placeholder="Montan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit"
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
                  {editInvId ? 'Anrejistre chanjman' : 'Anrejistre envestisman'}
                </button>
                {editInvId && (
                  <button type="button" onClick={() => { setEditInvId(null); setInvForm({ description: '', amount: '', type: 'merchandise' }); }}
                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                    Anile
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Envestisman yo</h3>
              <span className="text-amber-600 font-semibold text-sm">{fmt(totalInvestments)}</span>
            </div>

            {!loading && investments.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between text-xs text-gray-600">
                <span>Machandiz: <strong className="text-gray-800">{fmt(totalMerchandise)}</strong></span>
                <span>Kapital: <strong className="text-gray-800">{fmt(totalCapital)}</strong></span>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {loading && <div className="px-4 py-6 text-center text-gray-400 text-sm">Chajman...</div>}
              {!loading && investments.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">Pa gen envestisman toujou.</div>
              )}
              {investments.map(x => (
                <div key={x.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-800">{x.description || 'Envestisman'}</div>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      (x.type ?? 'merchandise') === 'merchandise'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {typeLabel(x.type ?? 'merchandise')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700">{fmt(x.amount)}</span>
                    <button onClick={() => startEditInvestment(x)}
                      className="text-xs text-blue-600 hover:underline">Modifye</button>
                    <button onClick={() => deleteInvestment(x.id)}
                      className="text-xs text-red-600 hover:underline">Efase</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}