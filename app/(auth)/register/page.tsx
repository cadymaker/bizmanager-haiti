'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    business_name: '', owner_name: '', email: '',
    password: '', phone: '', niche: 'retail',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      router.push('/login');
    } else {
      setError(data.error || 'Erè pandan enskripsyon.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1">Kreye kont biznis ou</h1>
          <p className="text-sm text-gray-400 mt-1">Esè gratis 14 jou — pa gen kat kredi</p>
        </div>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Non biznis la</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Boutique Marie Claire"
              value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Non propriyetè a</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Marie Claire Joseph"
              value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Imèl</label>
            <input type="email" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="marie@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Mo de pas</label>
            <input type="password" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimòm 6 karaktè"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Telefòn (opsyonèl)</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+509 xxxx-xxxx"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Tip biznis</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.niche} onChange={e => setForm({ ...form, niche: e.target.value })}>
              <option value="retail">Komès detay</option>
              <option value="shipping">Transpò / Lojistik</option>
              <option value="restaurant">Restoran</option>
              <option value="hotel">Otèl</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2">
            {loading ? 'Kreyasyon...' : 'Kreye kont mwen — Kòmanse esè gratis'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Ou gen yon kont deja?{' '}
          <a href="/login" className="text-blue-600 font-medium hover:underline">Konekte</a>
        </p>
      </div>
    </div>
  );
}  
