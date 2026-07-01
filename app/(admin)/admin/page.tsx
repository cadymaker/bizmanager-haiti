'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Business } from '@/types';

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Business | null>(null);
  const [duration, setDuration] = useState<'30days' | '1year'>('30days');
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Ou pa konekte.'); setLoading(false); return; }
    const { data: me } = await supabase.from('businesses').select('is_admin').eq('id', session.user.id).single();
    if (!me?.is_admin) { setError('Aksè refize — ou pa yon admin.'); setLoading(false); return; }
    const { data } = await supabase
      .from('businesses')
      .select('id, business_name, owner_name, email, phone, niche, license_status, trial_start_date, license_expiry_date, created_at')
      .order('created_at', { ascending: false });
    setBusinesses((data as any) ?? []);
    setLoading(false);
  }

  async function generate() {
    if (!selected) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/admin/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ businessId: selected.id, duration }),
    });
    const data = await res.json();
    if (res.ok) { setCode(data.code); } else { setCode('Erè: ' + (data.error ?? 'pa ka jenere')); }
  }

  function buildMessage() {
    const dur = duration === '30days' ? '30 jou' : '1 an';
    return `Bonjou ${selected?.business_name}! Men kod aktivasyon lisans ou pou ${dur}: ${code}. Ale nan Parametr, antre kod la, epi klike Aktive. Mesi! BizManager Haiti`;
  }

  function buildWhatsAppLink() {
    const phone = (selected?.phone ?? '').replace(/[^0-9]/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage())}`;
  }

  function buildEmailLink() {
    return `mailto:${selected?.email}?subject=${encodeURIComponent('Kod aktivasyon BizManager')}&body=${encodeURIComponent(buildMessage())}`;
  }

  function daysLeft(trialStart: string) {
    const start = new Date(trialStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }

  if (error) return (
    <div className="p-6"><div className="bg-red-50 text-red-600 rounded-xl p-4">{error}</div></div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin — Tout biznis</h1>
          <p className="text-sm text-gray-500 mt-1">{businesses.length} biznis enskri</p>
        </div>
        <a href="/dashboard" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
          ← Retounen nan aplikasyon
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">Esè aktif</p>
          <p className="text-2xl font-semibold mt-1">{businesses.filter(b => b.license_status === 'trial').length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">Lisans aktif</p>
          <p className="text-2xl font-semibold mt-1 text-green-600">{businesses.filter(b => b.license_status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">Ekspire</p>
          <p className="text-2xl font-semibold mt-1 text-red-600">{businesses.filter(b => b.license_status === 'expired').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Biznis</th>
              <th className="px-4 py-3">Imèl</th>
              <th className="px-4 py-3">Niche</th>
              <th className="px-4 py-3">Estati</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {businesses.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{b.business_name}</div>
                  <div className="text-xs text-gray-400">{b.owner_name}</div>
                </td>
                <td className="px-4 py-3 text-gray-500">{b.email}</td>
                <td className="px-4 py-3 capitalize">{b.niche}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    b.license_status === 'active' ? 'bg-green-100 text-green-700' :
                    b.license_status === 'trial' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {b.license_status === 'trial' ? `Esè — ${daysLeft(b.trial_start_date)}j` :
                     b.license_status === 'active' ? 'Aktif' : 'Ekspire'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setSelected(b); setCode(null); }}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">
                    Jenere kòd
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ minHeight: '400px', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
          <div className="bg-white rounded-xl p-6 w-80 space-y-4">
            <h2 className="font-semibold text-gray-900">Kòd pou {selected.business_name}</h2>
            <div className="flex gap-2">
              <button onClick={() => { setDuration('30days'); setCode(null); }}
                className={`flex-1 py-2 rounded-lg text-sm border ${duration === '30days' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                30 jou
              </button>
              <button onClick={() => { setDuration('1year'); setCode(null); }}
                className={`flex-1 py-2 rounded-lg text-sm border ${duration === '1year' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                1 an
              </button>
            </div>
            <button onClick={generate}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              Jenere kòd aktivasyon
            </button>
            {code && !code.startsWith('Erè') && (
              <div className="bg-gray-50 rounded-lg p-4 text-center space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Kòd pou voye bay kliyan:</p>
                  <p className="font-mono font-bold text-blue-700 text-base select-all break-all">{code}</p>
                  <button onClick={() => navigator.clipboard.writeText(code)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    Kopye kòd la
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                    WhatsApp
                  </a>
                  <a href={buildEmailLink()}
                    className="flex items-center justify-center py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    Email
                  </a>
                </div>
              </div>
            )}
            {code && code.startsWith('Erè') && (
              <div className="bg-red-50 rounded-lg p-3 text-center text-sm text-red-600">{code}</div>
            )}
            <button onClick={() => { setSelected(null); setCode(null); }}
              className="w-full py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-lg">
              Fèmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}