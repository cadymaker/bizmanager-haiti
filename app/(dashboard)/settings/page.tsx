'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { getLicenseInfo } from '@/lib/license';

const DELETE_REASONS = [
  { value: 'too_expensive', label: 'Pri lisans lan twò chè pou mwen' },
  { value: 'not_using', label: 'M pa itilize app la ase' },
  { value: 'too_complicated', label: 'App la twò konplike pou mwen' },
  { value: 'missing_features', label: 'App la pa gen sa m bezwen an' },
  { value: 'found_alternative', label: 'M jwenn yon lòt app ki pi bon pou mwen' },
  { value: 'business_closed', label: 'M fèmen oswa m sispann biznis la' },
  { value: 'technical_issues', label: 'M gen twòp pwoblèm teknik ak app la' },
  { value: 'other', label: 'Lòt rezon' },
];

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

  // Efase kont
  const [showDelete, setShowDelete] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', ctx.businessId)
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
    const ctx = await getBusinessContext();
    if (!ctx) { setLogoUploading(false); return; }

    const ext = file.name.split('.').pop();
    const fileName = `${ctx.businessId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true });

    if (upErr) { setMsg('Erè upload: ' + upErr.message); setLogoUploading(false); return; }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('businesses').update({ logo_url: logoUrl }).eq('id', ctx.businessId);
    setMsg('Logo modifye!');
    load();
    setLogoUploading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddr(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setSavingAddr(false); return; }

    const { error } = await supabase
      .from('businesses')
      .update({
        street: street || null,
        city: city || null,
        department: department || null,
      })
      .eq('id', ctx.businessId);

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

  // ===== Efase kont =====
  function openDelete() {
    setShowDelete(true);
    setDeleteStep(1);
    setReason('');
    setOtherNote('');
    setConfirmName('');
    setDeleteErr('');
  }

  function closeDelete() {
    if (deleting) return;
    setShowDelete(false);
  }

  const canGoStep2 =
    reason !== '' && (reason !== 'other' || otherNote.trim().length >= 3);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteErr('');

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDeleting(false); return; }

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        reason,
        note: otherNote,
        confirmName,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      await supabase.auth.signOut();
      window.location.href = '/login';
      return;
    }

    setDeleting(false);
    setDeleteErr(data.error ?? 'Pa ka efase kont lan.');
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

      {/* ENPRIMANT */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Enprimant tèmik</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Konekte yon enprimant Bluetooth 80mm pou enprime resi vant ak Rapò Z fèmti kès sou telefòn oswa tablèt Android.
        </p>
        <a href="/settings/printer"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100">
          🖨️ Wè gid konfigirasyon an
        </a>
      </div>

      {/* ÈD & OPINYON */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Èd &amp; Opinyon</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Jwenn repons pou kesyon ou yo, oswa di nou sa ou panse sou app la.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <a href="/settings/help"
            className="flex-1 text-center px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100">
            ❓ Èd &amp; Kesyon souvan
          </a>
          <a href="/settings/feedback"
            className="flex-1 text-center px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100">
            💬 Ban nou opinyon w
          </a>
        </div>
      </div>

      {/* LEGAL */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Legal</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enfòmasyon sou vi prive w ak kondisyon itilizasyon app la.</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            Politik Konfidansyalite
          </a>
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            Kondisyon Itilizasyon
          </a>
        </div>
      </div>

      {/* ZÒN DANJE — EFASE KONT */}
      {!business?.is_admin && (
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <h2 className="font-medium text-red-700">Zòn danje</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Si ou pa vle kontinye itilize BizManager, ou ka efase kont ou ak tout done biznis ou nèt.
            Aksyon sa a pa gen retou.
          </p>
          <button onClick={openDelete}
            className="mt-3 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
            🗑️ Efase kont mwen
          </button>
        </div>
      )}

      {/* ===== MODAL EFASE KONT ===== */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeDelete}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 my-4" onClick={e => e.stopPropagation()}>

            {deleteStep === 1 ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Nou regrèt wè w ale</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Anvan ou ale, di nou poukisa. Repons ou ap ede nou amelyore BizManager pou lòt biznis ayisyen yo.
                </p>

                <div className="space-y-2 mb-3">
                  {DELETE_REASONS.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-colors ${
                        reason === r.value
                          ? 'bg-blue-50 text-blue-800 border-blue-300 font-medium'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {reason === r.value ? '● ' : '○ '}{r.label}
                    </button>
                  ))}
                </div>

                {reason === 'other' && (
                  <div className="mb-3">
                    <label className="text-sm text-gray-600 font-medium">Eksplike rezon ou</label>
                    <textarea
                      autoFocus
                      rows={3}
                      placeholder="Ekri rezon ou isit la..."
                      value={otherNote}
                      onChange={e => setOtherNote(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {reason !== '' && reason !== 'other' && (
                  <div className="mb-3">
                    <label className="text-sm text-gray-600 font-medium">
                      Yon ti detay anplis (opsyonèl)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Sa ka ede nou amelyore..."
                      value={otherNote}
                      onChange={e => setOtherNote(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="flex gap-2 mt-5">
                  <button onClick={closeDelete}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                    Anile
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    disabled={!canGoStep2}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Kontinye
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-red-700 mb-2">⚠️ Konfime efasman an</h2>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-800 space-y-2">
                  <p className="font-medium">Aksyon sa a pa gen retou.</p>
                  <p>Tout done <strong>{business?.business_name}</strong> ap efase nèt nan sèvè a:</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    <li>Tout pwodwi ak foto yo</li>
                    <li>Tout fakti, vant, ak peman</li>
                    <li>Tout kliyan ak dèt</li>
                    <li>Tout depans ak envestisman</li>
                    <li>Tout sesyon kès ak rapò Z</li>
                    <li>Kont ou ak kont tout kesye yo</li>
                  </ul>
                  <p className="text-xs pt-1">
                    Si ou gen yon lisans aktif, ou <strong>p ap</strong> jwenn ranbousman.
                  </p>
                </div>

                <label className="text-sm text-gray-600 font-medium">
                  Pou konfime, tape non biznis ou egzakteman:
                </label>
                <p className="text-sm font-mono bg-gray-100 rounded px-3 py-2 my-2 select-all">
                  {business?.business_name}
                </p>
                <input
                  type="text"
                  autoFocus
                  placeholder="Tape non an isit la"
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />

                {deleteErr && (
                  <div className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{deleteErr}</div>
                )}

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setDeleteStep(1)}
                    disabled={deleting}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                  >
                    ← Retounen
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting || confirmName !== business?.business_name}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Ap efase...' : 'Efase nèt'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}