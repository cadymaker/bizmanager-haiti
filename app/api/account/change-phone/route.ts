import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendPhoneChangedEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAuth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user || !user.email) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { phone } = await req.json();
  if (!phone || !String(phone).trim()) {
    return NextResponse.json({ error: 'Tanpri antre yon nimewo.' }, { status: 400 });
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Biznis id = user.id (mèt la)
  const { error: updErr } = await admin
    .from('businesses')
    .update({ phone: String(phone).trim() })
    .eq('id', user.id);
  if (updErr) {
    return NextResponse.json({ error: 'Pa ka chanje nimewo a: ' + updErr.message }, { status: 500 });
  }

  try {
    const r = await sendPhoneChangedEmail({ to: user.email, phone: String(phone).trim() });
    if (!r.sent) console.error('[account] imèl telefòn pa pati:', r.error);
  } catch (e) { console.error('[account] erè imèl telefòn:', e); }

  return NextResponse.json({ ok: true });
}