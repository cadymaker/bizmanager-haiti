'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

interface Promotion {
  id: string;
  code: string;
  label: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  times_used: number;
  created_at: string;
}

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Ki eta yon promo ye kounye a?
function promoStatus(p: Promotion): { label: string; cls: string } {
  if (!p.is_active) return { label: 'Dezaktive', cls: 'bg-gray-100 text-gray-600' };
  const today = todayLocalDate();
  if (p.starts_at && today < p.starts_at) return { label: 'Poko kòmanse', cls: 'bg-blue-100 text-blue-700' };
  if (p.ends_at && today > p.ends_at) return { label: 'Fini', cls: 'bg-red-100 text-red-700' };
  return { label: 'Aktif', cls: 'bg-green-100 text-green-700' };
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    label: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    min_amount: '',
    starts_at: '',
    ends_at: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', ctx.businessId)
      .single();
    setCurrency(biz?.currency ?? 'HTG');

    const { data } = await supabase
      .from('promotions')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    setPromos((data as any) ?? []);
    setLoading(false);
  }

  function resetForm() {
    setForm({
      code: '', label: '', discount_type: 'percent',
      discount_value: '', min_amount: '', starts_at: '', ends_at: '',
    });
    setEditId(null);
    setShowForm(false);
    setErr('');
  }

  function startEdit(p: Promotion) {
    setForm({
      code: p.code,
      label: p.label ?? '',
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      min_amount: p.min_amount != null ? String(p.min_amount) : '',
      starts_at: p.starts_at ?? '',
      ends_at: p.ends_at ?? '',
    });
    setEditId(p.id);
    setShowForm(true);
    setErr('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    const code = form.code.trim().toUpperCase();
    const value = parseFloat(form.discount_value);

    if (!code) { setErr('Kòd la obligatwa.'); return; }
    if (isNaN(value) || value <= 0) { setErr('Valè rabè a dwe pi gran pase 0.'); return; }
    if (form.discount_type === 'percent' && value > 100) {
      setErr('Yon pousantaj pa ka depase 100%.'); return;
    }
    if (form.starts_at && form.ends_at && form.starts_at > form.ends_at) {
      setErr('Dat fen an pa ka anvan dat kòmansman an.'); return;
    }

    setSaving(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setSaving(false); return; }

    const payload = {
      business_id: ctx.businessId,
      code: code,
      label: form.label.trim() || null,
      discount_type: form.discount_type,
      discount_value: value,
      min_amount: form.min_amount ? parseFloat(form.min_amount) : null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      created_by: ctx.userId,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('promotions').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('promotions').insert(payload));
    }

    setSaving(false);

    if (error) {
      if (error.message.includes('idx_promo_code_per_business') || error.code === '23505') {
        setErr(`Kòd "${code}" deja egziste. Chwazi yon lòt kòd.`);
      } else {
        setErr('Erè: ' + error.message);
      }
      return;
    }

    setMsg(editId ? 'Promo modifye!' : 'Promo kreye!');
    setTimeout(() => setMsg(''), 3000);
    resetForm();
    load();
  }

  async function toggleActive(p: Promotion) {
    const supabase = createClient();
    await supabase
      .from('promotions')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    setMsg(p.is_active ? `Promo ${p.code} dezaktive.` : `Promo ${p.code} aktive.`);
    setTimeout(() => setMsg(''), 3000);
    load();
  }

  const fmt = (n: number) => formatMoney(n, currency);

  const activeCount = promos.filter(p => promoStatus(p).label === 'Aktif').length;
  const totalUsed = promos.reduce((s, p) => s + Number(p.times_used || 0), 0);

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pwomosyon</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kreye kòd rabè pou kesye yo ka aplike nan sistèm vant lan.
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + Nouvo promo
        </button>
      </div>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total promo</p>
          <p className="text-xl font-semibold mt-1">{promos.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Promo aktif</p>
          <p className="text-xl font-semibold mt-1 text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fwa yo itilize</p>
          <p className="text-xl font-semibold mt-1">{totalUsed}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-medium text-gray-800">
            {editId ? 'Modifye promo' : 'Nouvo promo'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Kòd promo *</label>
              <input placeholder="Ex: NWEL2026" required
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase font-mono"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Se sa kesye a ap tape nan POS la.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Deskripsyon (opsyonèl)</label>
              <input placeholder="Ex: Rabè fen ane"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Kalite rabè *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => setForm({ ...form, discount_type: 'percent' })}
                className={`py-2 rounded-lg text-sm font-medium border ${
                  form.discount_type === 'percent'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                Pousantaj (%)
              </button>
              <button type="button" onClick={() => setForm({ ...form, discount_type: 'fixed' })}
                className={`py-2 rounded-lg text-sm font-medium border ${
                  form.discount_type === 'fixed'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                Montan fiks ({currency})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">
                Valè rabè * {form.discount_type === 'percent' ? '(%)' : `(${currency})`}
              </label>
              <input type="number" required
                placeholder={form.discount_type === 'percent' ? '10' : '500'}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right font-semibold"
                value={form.discount_value}
                onChange={e => setForm({ ...form, discount_value: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Minimòm acha (opsyonèl)</label>
              <input type="number" placeholder="Ex: 5000"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right"
                value={form.min_amount}
                onChange={e => setForm({ ...form, min_amount: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Kite vid si pa gen minimòm.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Dat kòmansman (opsyonèl)</label>
              <input type="date"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Dat fen (opsyonèl)</label>
              <input type="date"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Kite vid pou yon promo san dat limit.</p>
            </div>
          </div>

          {err && (
            <div className="text-sm rounded-lg p-2 bg-red-50 text-red-700">{err}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Ap anrejistre...' : editId ? 'Anrejistre chanjman' : 'Kreye promo a'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Anile
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Kòd</th>
              <th className="px-4 py-3">Rabè</th>
              <th className="px-4 py-3">Kondisyon</th>
              <th className="px-4 py-3">Estati</th>
              <th className="px-4 py-3 text-right">Itilize</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {promos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                Pa gen okenn promo toujou. Klike "+ Nouvo promo".
              </td></tr>
            )}
            {promos.map(p => {
              const st = promoStatus(p);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-gray-900">{p.code}</div>
                    {p.label && <div className="text-xs text-gray-400">{p.label}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-green-700">
                    {p.discount_type === 'percent'
                      ? `${p.discount_value}%`
                      : fmt(Number(p.discount_value))}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.min_amount ? <div>Min: {fmt(Number(p.min_amount))}</div> : null}
                    {p.starts_at ? <div>Depi: {p.starts_at}</div> : null}
                    {p.ends_at ? <div>Jiska: {p.ends_at}</div> : null}
                    {!p.min_amount && !p.starts_at && !p.ends_at ? '—' : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.times_used}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(p)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                        Modifye
                      </button>
                      <button onClick={() => toggleActive(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                          p.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}>
                        {p.is_active ? 'Dezaktive' : 'Aktive'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Kijan promo yo mache</p>
        <ul className="list-disc list-inside text-xs space-y-0.5">
          <li>Nan POS la, kesye a klike "🎟️ Kòd promo" epi tape kòd la.</li>
          <li>Sistèm nan verifye dat yo ak minimòm acha a otomatikman.</li>
          <li>Yon promo ki dezaktive pa ka itilize, men istorik la rete.</li>
          <li>Kesye yo dwe rafrechi POS la apre ou kreye yon nouvo promo.</li>
        </ul>
      </div>
    </div>
  );
}