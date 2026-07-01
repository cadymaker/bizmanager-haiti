'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [licenseStatus, setLicenseStatus] = useState('');
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: biz } = await supabase
      .from('businesses')
      .select('license_status, license_expiry_date, trial_start_date, logo_url, activation_code_hash')
      .eq('id', session.user.id)
      .single();

    if (biz) {
      setLicenseStatus(biz.license_status);
      setExpiryDate(biz.license_expiry_date);
      setLogoUrl(biz.logo_url ?? '');
      if (biz.license_status === 'trial') {
        const start = new Date(biz.trial_start_date);
        const end = new Date(start);
        end.setDate(end.getDate() + 14);
        setTrialDays(Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)));
      }
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setMsg({ type: 'error', text: 'Erè telechajman: ' + uploadError.message });
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    const finalUrl = `${publicUrl}?t=${Date.now()}`;

    await supabase.from('businesses').update({ logo_url: finalUrl }).eq('id', session.user.id);

    setLogoUrl(finalUrl);
    setMsg({ type: 'success', text: 'Logo telechaje ak siksè!' });
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleActivate() {
    if (!code.trim()) return;
    setLoading(true);
    const res = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: 'success', text: data.message });
      load();
    } else {
      setMsg({ type: 'error', text: data.error });
    }
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Paramèt</h1>

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${
          msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{msg.text}</div>
      )}

      {/* LOGO */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-medium text-gray-800 mb-1">Logo biznis la</h2>
        <p className="text-sm text-gray-500 mb-4">
          Logo sa a ap parèt sou tout fakti ou yo.
        </p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl text-gray-300">🏢</span>
            )}
          </div>
          <div>
            <input type="file" accept="image/*" onChange={handleLogoUpload}
              disabled={loading}
              className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            <p className="text-xs text-gray-400 mt-2">PNG, JPG — max 2MB</p>
          </div>
        </div>
      </div>

      {/* LISANS */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-medium text-gray-800 mb-1">Lisans & Aktivasyon</h2>
        <p className="text-sm text-gray-500 mb-4">
          Apre peman <strong>MonCash</strong> oswa <strong>Cash</strong>,
          antre kòd la pou aktive lisans ou.
        </p>

        <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            licenseStatus === 'active' ? 'bg-green-500' :
            licenseStatus === 'trial' ? 'bg-amber-500' : 'bg-red-500'
          }`} />
          <span>
            Estati: <strong>{
              licenseStatus === 'active' ? 'Aktif' :
              licenseStatus === 'trial' ? `Esè — ${trialDays} jou rete` : 'Ekspire'
            }</strong>
            {expiryDate && licenseStatus === 'active' && (
              <span className="text-gray-500 ml-2">
                (expire {new Date(expiryDate).toLocaleDateString('fr-HT')})
              </span>
            )}
          </span>
        </div>

        <div className="flex gap-2">
          <input placeholder="Kòd aktivasyon"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          <button onClick={handleActivate} disabled={loading || !code.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {loading ? '...' : 'Aktive'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Tarif: 30 jou — 500 HTG | 1 an — 4 000 HTG. Peman: MonCash oswa Cash.
        </p>
      </div>
    </div>
  );
}