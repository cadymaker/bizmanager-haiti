'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/currency';

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
}

interface Investment {
  id: string;
  description: string;
  amount: number;
  invest_date: string;
}

const CATEGORIES = [
  { value: 'loyer', label: 'Lwaye' },
  { value: 'electricite', label: 'Elektrisite' },
  { value: 'eau', label: 'Dlo' },
  { value: 'salaire', label: 'Salè' },
  { value: 'transport', label: 'Transpò' },
  { value: 'autre', label: 'Lòt' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
const [currency, setCurrency] = useState('HTG');

  const [expForm, setExpForm] = useState({ category: 'loyer', description: '', amount: '' });
  const [invForm, setInvForm] = useState({ description: '', amount: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data: bizCur } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', session.user.id)
      .single();
    setCurrency(bizCur?.currency ?? 'HTG');

    const { data: exp } = await supabase
      .from('expenses')
      .select('id, category, description, amount, expense_date')
      .eq('business_id', session.user.id)
      .order('expense_date', { ascending: false });
    setExpenses(exp ?? []);

    const { data: inv } = await supabase
      .from('investments')
      .select('id, description, amount, invest_date')
      .eq('business_id', session.user.id)
      .order('invest_date', { ascending: false });
    setInvestments(inv ?? []);

    setLoading(false);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(expForm.amount);
    if (!amount || amount <= 0) { setMsg('Antre yon montan valab.'); return; }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('expenses').insert({
      business_id: session.user.id,
      category: expForm.category,
      description: expForm.description || null,
      amount,
      expense_date: new Date().toISOString().split('T')[0],
    });

    if (!error) {
      setExpForm({ category: 'loyer', description: '', amount: '' });
      setMsg('Depans anrejistre!');
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  async function addInvestment(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(invForm.amount);
    if (!amount || amount <= 0) { setMsg('Antre yon montan valab.'); return; }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('investments').insert({
      business_id: session.user.id,
      description: invForm.description || 'Envestisman',
      amount,
      invest_date: new Date().toISOString().split('T')[0],
    });

    if (!error) {
      setInvForm({ description: '', amount: '' });
      setMsg('Envestisman anrejistre!');
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

 const fmt = (n: number) => formatMoney(n, currency);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvestments = investments.reduce((s, i) => s + i.amount, 0);

  function catLabel(v: string) {
    return CATEGORIES.find(c => c.value === v)?.label ?? v;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Depans & Envestisman</h1>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DEPANS */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-3">Ajoute yon depans</h2>
            <form onSubmit={addExpense} className="space-y-3">
              <select value={expForm.category}
                onChange={e => setExpForm({ ...expForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input placeholder="Deskripsyon (opsyonèl)"
                value={expForm.description}
                onChange={e => setExpForm({ ...expForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="number" placeholder="Montan (HTG)"
                value={expForm.amount}
                onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button type="submit"
                className="w-full py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                Anrejistre depans
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-medium text-gray-800 text-sm">Depans yo</h3>
              <span className="text-sm font-semibold text-red-600">{fmt(totalExpenses)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {loading && <tr><td className="px-4 py-4 text-center text-gray-400">Chajman...</td></tr>}
                {!loading && expenses.length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-gray-400">Pa gen depans toujou.</td></tr>
                )}
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{catLabel(e.category)}</div>
                      {e.description && <div className="text-xs text-gray-400">{e.description}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {new Date(e.expense_date).toLocaleDateString('fr-HT')}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ENVESTISMAN */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-3">Ajoute yon envestisman</h2>
            <p className="text-xs text-gray-500 mb-3">Acha machandiz, kapital inisyal, elatriye.</p>
            <form onSubmit={addInvestment} className="space-y-3">
              <input placeholder="Deskripsyon (ex: Acha stòk)"
                value={invForm.description}
                onChange={e => setInvForm({ ...invForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="number" placeholder="Montan (HTG)"
                value={invForm.amount}
                onChange={e => setInvForm({ ...invForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button type="submit"
                className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                Anrejistre envestisman
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-medium text-gray-800 text-sm">Envestisman yo</h3>
              <span className="text-sm font-semibold text-amber-600">{fmt(totalInvestments)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {loading && <tr><td className="px-4 py-4 text-center text-gray-400">Chajman...</td></tr>}
                {!loading && investments.length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-gray-400">Pa gen envestisman toujou.</td></tr>
                )}
                {investments.map(i => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 font-medium">{i.description}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {new Date(i.invest_date).toLocaleDateString('fr-HT')}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}