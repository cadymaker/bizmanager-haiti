'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

type Msg = { type: 'success' | 'error'; text: string } | null;

export default function AccountSection() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<Msg>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

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
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.totp ?? []).some((f) => f.status === 'verified');
      setTwoFAEnabled(verified);
    } catch { /* inyore */ }
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
    } else {
      setPwMsg({ type: 'error', text: data.error ?? 'Erè.' });
    }
    setSavingPw(false);
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      <div>
        <h2 className="font-medium text-gray-800">Kont</h2>
        <p className="text-sm text-gray-500 mt-0.5">Jere imèl, telefòn, modpas, ak sekirite kont ou.</p>
      </div>

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

      {/* Modpas */}
      <form onSubmit={changePassword} className="border-t border-gray-100 pt-5">
        <label className="text-sm font-medium text-gray-700">Chanje modpas</label>
        {pwMsg && (
          <div className={`text-sm rounded-lg p-2 mt-2 ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{pwMsg.text}</div>
        )}
        <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
          placeholder="Modpas aktyèl" autoComplete="current-password"
          className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
          placeholder="Nouvo modpas (min 6 karaktè)" autoComplete="new-password"
          className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
          placeholder="Konfime nouvo modpas" autoComplete="new-password"
          className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <button type="submit" disabled={savingPw || !curPw || !newPw || !confirmPw}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {savingPw ? 'Ap chanje...' : 'Chanje modpas'}
        </button>
      </form>

      {/* Verifikasyon 2 etap (estati sèlman pou kounye a) */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Verifikasyon an 2 etap</p>
            <p className="text-xs text-gray-400 mt-0.5">Yon kouch sekirite anplis lè w konekte.</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${twoFAEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {twoFAEnabled ? 'Aktif' : 'Pa aktif'}
          </span>
        </div>
      </div>
    </div>
  );
}