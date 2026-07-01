'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Client } from '@/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', session.user.id)
      .order('name');
    setClients(data ?? []);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('clients').insert({
      business_id: session.user.id,
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
    });

    if (!error) {
      setForm({ name: '', phone: '', address: '' });
      setMsg('Kliyan ajoute ak siksè!');
      loadClients();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-HT').format(n) + ' HTG';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Clients / Dèt</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium text-gray-800 mb-3">Ajoute nouvo kliyan</h2>
        {msg && (
          <div className="bg-green-50 text-green-700 text-sm rounded-lg p-2 mb-3">{msg}</div>
        )}
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input placeholder="Non kliyan *" required
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Telefòn"
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Adrès"
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Ajoute
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Non</th>
              <th className="px-4 py-3">Telefòn</th>
              <th className="px-4 py-3">Adrès</th>
              <th className="px-4 py-3">Dèt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Pa gen kliyan toujou.</td></tr>
            )}
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.address || '—'}</td>
                <td className={`px-4 py-3 font-medium ${c.total_debt > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {c.total_debt > 0 ? fmt(c.total_debt) : 'Soldé'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}