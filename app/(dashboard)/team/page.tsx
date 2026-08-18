'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'cashier';
  full_name: string | null;
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [myUserId, setMyUserId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');

  const [form, setForm] = useState({ full_name: '', email: '', password: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    setIsOwner(ctx.role === 'owner');
    setMyUserId(ctx.userId);

    // Sèlman mèt ka wè lis la — chèche atravè API sèvè a (ak service key)
    if (ctx.role === 'owner') {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch('/api/team', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members ?? []);
        }
      }
    }

    setLoading(false);
  }

  async function addCashier(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setMsg('Tout chan yo obligatwa.'); setMsgType('err'); return;
    }
    if (form.password.length < 6) {
      setMsg('Modpas la dwe gen omwen 6 karaktè.'); setMsgType('err'); return;
    }

    setSaving(true);
    setMsg('');

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (res.ok) {
      setMsg('Kesye ajoute ak siksè!'); setMsgType('ok');
      setForm({ full_name: '', email: '', password: '' });
      setShowForm(false);
      load();
      setTimeout(() => setMsg(''), 4000);
    } else {
      setMsg(data.error ?? 'Erè pandan kreyasyon an.'); setMsgType('err');
    }
    setSaving(false);
  }

  async function removeCashier(m: Member) {
    if (!confirm(`Retire ${m.full_name || 'itilizatè sa a'}? Li p ap ka konekte ankò. Aksyon sa a pa ka defèt.`)) return;

    setRemovingId(m.user_id);
    setMsg('');

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRemovingId(null); return; }

    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: m.user_id }),
    });
    const data = await res.json();

    if (res.ok) {
      setMsg('Itilizatè retire ak siksè.'); setMsgType('ok');
      load();
      setTimeout(() => setMsg(''), 4000);
    } else {
      setMsg(data.error ?? 'Erè pandan retire a.'); setMsgType('err');
    }
    setRemovingId(null);
  }

  const roleLabel = (r: string) => r === 'owner' ? 'Mèt' : 'Kesye';

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  // Sèlman mèt ka wè paj sa a
  if (!isOwner) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          Sèlman mèt biznis la gen aksè nan paj sa a.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Itilizatè yo</h1>
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Fèmen' : '+ Ajoute kesye'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Ajoute kesye pou ede w vann. Yon kesye ka sèvi ak sistèm vant lan, men li pa ka wè dashboard, envantè, oswa paramèt yo.
      </p>

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msgType === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
      )}

      {showForm && (
        <form onSubmit={addCashier} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-medium text-gray-800">Nouvo kesye</h2>
          <div>
            <label className="text-xs text-gray-500 font-medium">Non konplè</label>
            <input placeholder="Jean Pierre"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Imèl</label>
            <input type="email" placeholder="jean@example.com"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Kesye a ap konekte ak imèl sa a.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Modpas</label>
            <input type="password" placeholder="Minimòm 6 karaktè"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} />
            <p className="text-xs text-gray-400 mt-1">Bay kesye a modpas sa a pou l ka konekte.</p>
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Ap kreye...' : 'Kreye kesye a'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-800">Moun ki gen aksè ({members.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map(m => (
            <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-800">{m.full_name || 'San non'}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {roleLabel(m.role)}
                </span>
                {/* Bouton Retire — sèlman pou kesye (pa pou mèt la limenm) */}
                {m.role === 'cashier' && m.user_id !== myUserId && (
                  <button onClick={() => removeCashier(m)} disabled={removingId === m.user_id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50">
                    {removingId === m.user_id ? 'Ap retire...' : 'Retire'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}