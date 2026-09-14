import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordChangedEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabaseAuth = createClient(url, anonKey);
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user || !user.email) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Tanpri ranpli tou de chan yo.' }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: 'Nouvo modpas la dwe gen omwen 6 karaktè.' }, { status: 400 });
  }

  // 1) Verifye modpas aktyèl la (san touche sesyon reyèl la)
  const check = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await check.auth.signInWithPassword({
    email: user.email, password: currentPassword,
  });
  if (signInErr) {
    return NextResponse.json({ error: 'Modpas aktyèl la pa kòrèk.' }, { status: 400 });
  }

  // 2) Chanje modpas la ak admin
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (updErr) {
    return NextResponse.json({ error: 'Pa ka chanje modpas la: ' + updErr.message }, { status: 500 });
  }

  // 3) Imèl konfimasyon — pa bloke
  try {
    const r = await sendPasswordChangedEmail({ to: user.email });
    if (!r.sent) console.error('[account] imèl modpas pa pati:', r.error);
  } catch (e) { console.error('[account] erè imèl modpas:', e); }

  return NextResponse.json({ ok: true });
}