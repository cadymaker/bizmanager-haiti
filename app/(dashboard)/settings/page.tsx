'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLicenseInfo } from '@/lib/license';

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [msg, setMsg] = useState('');

  // Adrès
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [department, setDepartment] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);
  const [editingAddr, setEditingAddr] = useState(false);

  // Aktivasyon
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setBusiness(data);
    setStreet(data?.street ?? '');
    setCity(data?.city ?? '');
    setDepartment(data?.department ?? '');
    setLoading(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg('Imaj la twò gwo (max 2MB).'); return; }

    setLogoUploading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLogoUploading(false); return; }

    const ext = file.name.split('.').pop();
    const fileName = `${session.user.id}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true });

    if (upErr) { setMsg('Erè upload: ' + upErr.message); setLogoUploading(false); return; }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('businesses').update({ logo_url: logoUrl }).eq('id', session.user.id);
    setMsg('Logo modifye!');
    load();
    setLogoUploading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddr(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingAddr(false); return; }

    const { error } = await supabase
      .from('businesses')
      .update({
        street: street || null,
        city: city || null,
        department: department || null,
      })
      .eq('id', session.user.id);

    if (!error) {
      setMsg('Adrès anrejistre!');
      setEditingAddr(false);
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
    setSavingAddr(false);
  }

  async function handleActivate() {
    if (!code.trim()) return;
    setActivating(true);
    setActivateMsg('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setActivating(false); return; }

    const res = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setActivateMsg('Lisans aktive ak siksè!');
      setCode('');
      load();
    } else {
      setActivateMsg('Erè: ' + (data.error ?? 'Kòd envalid'));
    }
    setActivating(false);
  }

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  const lic = business ? getLicenseInfo(business) : null;
  const hasAddress = business?.street || business?.city || business?.department;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Paramèt</h1>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      {/* LOGO */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Logo biznis la</h2>
        <p className="text-sm text-gray-500 mt-0.5">Logo sa a ap parèt sou tout fakti ou yo.</p>
        <div className="flex items-center gap-4 mt-3">
          <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {business?.logo_url ? (
              <img src={business.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">Pa gen logo</span>
            )}
          </div>
          <div>
            <input type="file" accept="image/*" onChange={handleLogoUpload}
              className="block text-sm text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm hover:file:bg-blue-100" />
            {logoUploading && <p className="text-xs text-blue-600 mt-1">Ap upload...</p>}
            <p className="text-xs text-gray-400 mt-1">PNG, JPG — max 2MB</p>
          </div>
        </div>
      </div>

      {/* ADRÈS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-medium text-gray-800">Adrès biznis la</h2>
            <p className="text-sm text-gray-500 mt-0.5">Adrès sa a ap parèt sou fakti ou yo (Ayiti ak telefòn nan ajoute otomatikman).</p>
          </div>
          {!editingAddr && hasAddress && (
            <button onClick={() => setEditingAddr(true)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 flex-shrink-0">
              Modifye
            </button>
          )}
        </div>

        {!editingAddr && hasAddress ? (
          <div className="bg-gray-50 rounded-lg p-4 mt-3 text-sm text-gray-700 space-y-0.5">
            {business?.street && <p>{business.street}</p>}
            <p>
              {[business?.city, business?.department].filter(Boolean).join(', ')}
              {(business?.city || business?.department) ? ', Ayiti' : 'Ayiti'}
            </p>
            {business?.phone && <p className="text-gray-500">{business.phone}</p>}
          </div>
        ) : (
          <form onSubmit={saveAddress} className="space-y-3 mt-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Ri / Lokalite</label>
              <input placeholder="ex: Ri Lamartinière #12"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={street} onChange={e => setStreet(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Vil</label>
                <input placeholder="ex: Gonaïves"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Depatman</label>
                <input placeholder="ex: Latibonit"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={department} onChange={e => setDepartment(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingAddr}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingAddr ? 'Ap anrejistre...' : 'Anrejistre adrès'}
              </button>
              {hasAddress && (
                <button type="button" onClick={() => { setEditingAddr(false); setStreet(business?.street ?? ''); setCity(business?.city ?? ''); setDepartment(business?.department ?? ''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                  Anile
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* LISANS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Lisans &amp; Aktivasyon</h2>
        <p className="text-sm text-gray-500 mt-0.5">Apre peman MonCash oswa Cash, antre kòd la pou aktive lisans ou.</p>

        {lic && (
          <div className="bg-gray-50 rounded-lg p-3 mt-3 text-sm">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${lic.status === 'active' ? 'bg-green-500' : lic.status === 'trial' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
            Estati: <strong className="text-gray-800">
              {lic.status === 'active' ? 'Aktif' : lic.status === 'trial' ? `Esè (${lic.daysRemaining} jou rete)` : 'Ekspire'}
            </strong>
            {lic.status === 'active' && lic.expiryDate && (
              <span className="text-gray-500"> (expire {new Date(lic.expiryDate).toLocaleDateString('fr-HT')})</span>
            )}
          </div>
        )}

        {activateMsg && (
          <div className={`text-sm rounded-lg p-2 mt-3 ${activateMsg.startsWith('Erè') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{activateMsg}</div>
        )}

        <div className="flex gap-2 mt-3">
          <input placeholder="KÒD AKTIVASYON" value={code}
            onChange={e => setCode(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
          <button onClick={handleActivate} disabled={activating}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {activating ? '...' : 'Aktive'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Tarif: 30 jou — 1 000 HTG | 90 jou — 2 500 HTG | 1 an — 10 000 HTG. Peman: MonCash oswa Cash.
        </p>
      </div>
    </div>
  );
}