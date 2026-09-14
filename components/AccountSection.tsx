'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

type Msg = { type: 'success' | 'error'; text: string } | null;

export default function AccountSection() {
  const [expanded, setExpanded] = useState(false);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<Msg>(null);

  const [editingPw, setEditingPw] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [savingTwoFA, setSavingTwoFA] = useState(false);
  const [twoFAMsg, setTwoFAMsg] = useState<Msg>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) setEmail(session.user.email);

    const ctx = await getBusinessContext();
    if (ctx) {
      const { data } = await supabase.from('businesses').select('phone').eq('id', ctx.businessId).single();
      setPhone(data?.phone ?? '');
      setPhoneInput(data?.phone ?? '');
    }

    const token = session?.access_token;
    if (token) {
      try {
        const r = await fetch('/api/account/2fa', { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        setTwoFAEnabled(!!j.enabled);
      } catch { /* inyore */ }
    }
    setLoading(false);
  }

  async function changePhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMsg(null);
    if (!phoneInput.trim()) { setPhoneMsg({ type: 'error', text: 'Antre yon nimewo.' }); return; }
    setSavingPhone(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingPhone(false); return; }
    const res = await fetch('/api/account/change-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ phone: phoneInput.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setPhone(phoneInput.trim());
      setPhoneMsg({ type: 'success', text: 'Nimewo telefòn chanje. Nou voye yon imèl konfimasyon.' });
    } else {
      setPhoneMsg({ type: 'error', text: data.error ?? 'Erè.' });
    }
    setSavingPhone(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Nouvo modpas la dwe gen omwen 6 karaktè.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'De nouvo modpas yo pa menm.' }); return; }
    setSavingPw(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingPw(false); return; }
    const res = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg({ type: 'success', text: 'Modpas ou chanje. Nou voye yon imèl konfimasyon.' });
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setEditingPw(false);
    } else {
      setPwMsg({ type: 'error', text: data.error ?? 'Erè.' });
    }
    setSavingPw(false);
  }

  function cancelPwEdit() {
    setEditingPw(false);
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setPwMsg(null);
  }

  async function toggle2FA() {
    setSavingTwoFA(true);
    setTwoFAMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingTwoFA(false); return; }
    const res = await fetch('/api/account/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ enabled: !twoFAEnabled }),
    });
    const data = await res.json();
    if (res.ok) {
      setTwoFAEnabled(data.enabled);
      setTwoFAMsg({
        type: 'success',
        text: data.enabled
          ? 'Verifikasyon 2 etap aktive. Pwochèn fwa w konekte, w ap resevwa yon kòd pa imèl.'
          : 'Verifikasyon 2 etap dezaktive.',
      });
    } else {
      setTwoFAMsg({ type: 'error', text: data.error ?? 'Erè.' });
    }
    setSavingTwoFA(false);
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Antèt ki louvri/fèmen */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left">
        <div>
          <h2 className="font-medium text-gray-800">Kont</h2>
          <p className="text-sm text-gray-500 mt-0.5">Jere imèl, telefòn, modpas, ak sekirite kont ou.</p>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          {/* Imèl (lekti sèlman) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Imèl</label>
            <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {email || '—'}
            </div>
          </div>

          {/* Telefòn */}
          <form onSubmit={changePhone}>
            <label className="text-xs text-gray-500 font-medium">Nimewo telefòn</label>
            {phoneMsg && (
              <div className={`text-sm rounded-lg p-2 mt-1 ${phoneMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{phoneMsg.text}</div>
            )}
            <div className="flex gap-2 mt-1">
              <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                placeholder="+509 xxxx-xxxx"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button type="submit" disabled={savingPhone || phoneInput.trim() === phone}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingPhone ? '...' : 'Chanje'}
              </button>
            </div>
          </form>

          {/* Modpas — kache dèyè yon bouton Modifye */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Modpas</p>
                <p className="text-xs text-gray-400 mt-0.5">••••••••</p>
              </div>
              {!editingPw && (
                <button onClick={() => setEditingPw(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                  Modifye
                </button>
              )}
            </div>

            {pwMsg && !editingPw && (
              <div className={`text-sm rounded-lg p-2 mt-3 ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{pwMsg.text}</div>
            )}

            {editingPw && (
              <form onSubmit={changePassword} className="mt-3">
                {pwMsg && (
                  <div className={`text-sm rounded-lg p-2 mb-2 ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{pwMsg.text}</div>
                )}
                <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
                  placeholder="Modpas aktyèl" autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="Nouvo modpas (min 6 karaktè)" autoComplete="new-password"
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Konfime nouvo modpas" autoComplete="new-password"
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <div className="flex gap-2 mt-3">
                  <button type="submit" disabled={savingPw || !curPw || !newPw || !confirmPw}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {savingPw ? 'Ap chanje...' : 'Chanje modpas'}
                  </button>
                  <button type="button" onClick={cancelPwEdit}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                    Anile
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Verifikasyon 2 etap */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Verifikasyon an 2 etap</p>
                <p className="text-xs text-gray-400 mt-0.5">Resevwa yon kòd pa imèl chak fwa w konekte.</p>
              </div>
              <button onClick={toggle2FA} disabled={savingTwoFA}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex-shrink-0 ${twoFAEnabled ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {savingTwoFA ? '...' : twoFAEnabled ? 'Dezaktive' : 'Aktive'}
              </button>
            </div>
            {twoFAMsg && (
              <div className={`text-sm rounded-lg p-2 mt-3 ${twoFAMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{twoFAMsg.text}</div>
            )}
            <span className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${twoFAEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {twoFAEnabled ? 'Aktif' : 'Pa aktif'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}