'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Msg = { type: 'error' | 'info'; text: string } | null;

export default function VerifyTwoFAPage() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const sentOnce = useRef(false);

  useEffect(() => { init(); }, []);

  async function getToken(): Promise<string | null> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function init() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    setEmail(session.user?.email ?? '');
    if (!sentOnce.current) {
      sentOnce.current = true;
      sendCode(session.access_token, true);
    }
  }

  async function sendCode(token?: string | null, silent = false) {
    setSending(true);
    if (!silent) setMsg(null);
    const t = token ?? (await getToken());
    if (!t) { window.location.href = '/login'; return; }
    try {
      const res = await fetch('/api/2fa/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await res.json();
      if (j.twoFactorRequired === false) {
        window.location.href = '/dashboard'; // 2FA pa aktif — pa gen anyen pou verifye
        return;
      }
      if (!res.ok) setMsg({ type: 'error', text: j.error ?? 'Pa ka voye kòd la.' });
      else if (!silent) setMsg({ type: 'info', text: 'Nou voye yon nouvo kòd nan imèl ou.' });
    } catch {
      setMsg({ type: 'error', text: 'Erè rezo.' });
    }
    setSending(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\d{6}$/.test(code)) { setMsg({ type: 'error', text: 'Antre kòd 6 chif la.' }); return; }
    setVerifying(true);
    const t = await getToken();
    if (!t) { window.location.href = '/login'; return; }
    const res = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ code }),
    });
    const j = await res.json();
    if (res.ok) {
      const { getBusinessContext } = await import('@/lib/business');
      const ctx = await getBusinessContext();
      window.location.href = ctx?.role === 'cashier' ? '/pos' : '/dashboard';
    } else {
      setMsg({ type: 'error', text: j.error ?? 'Kòd la pa kòrèk.' });
      setVerifying(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1">Verifikasyon an 2 etap</h1>
          <p className="text-sm text-gray-500 mt-2">
            Nou voye yon kòd 6 chif {email ? `nan ${email}` : 'nan imèl ou'}. Antre l pou fini koneksyon an.
          </p>
        </div>
        {msg && (
          <div className={`text-sm rounded-lg p-3 mb-4 ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{msg.text}</div>
        )}
        <form onSubmit={verify} className="space-y-3">
          <input
            inputMode="numeric" maxLength={6} autoFocus
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="------"
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={verifying || code.length !== 6}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {verifying ? 'Ap verifye...' : 'Verifye epi konekte'}
          </button>
        </form>
        <div className="flex justify-between items-center mt-4 text-sm">
          <button onClick={() => sendCode()} disabled={sending} className="text-blue-600 hover:underline disabled:opacity-50">
            {sending ? 'Ap voye...' : 'Voye kòd la ankò'}
          </button>
          <button onClick={logout} className="text-gray-500 hover:underline">Dekonekte</button>
        </div>
      </div>
    </div>
  );
}