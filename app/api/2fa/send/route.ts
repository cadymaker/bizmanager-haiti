import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendLoginCodeEmail } from '@/lib/email';

export const runtime = 'nodejs';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min
const THROTTLE_MS = 90 * 1000;      // pa re-voye anvan 90s

function hashCode(code: string) {
  const secret = process.env.LICENSE_SECRET_KEY ?? 'bzm-fallback';
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user || !user.email) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2FA aktif pou itilizatè sa a?
  const { data: bu } = await admin
    .from('business_users').select('two_factor_email').eq('user_id', user.id).maybeSingle();
  if (!bu?.two_factor_email) {
    return NextResponse.json({ twoFactorRequired: false });
  }

  // Throttle: si gen yon kòd resan ki poko ekspire, pa voye yon lòt
  const { data: existing } = await admin
    .from('login_codes').select('created_at, expires_at').eq('user_id', user.id).maybeSingle();
  if (existing
      && new Date(existing.expires_at).getTime() > Date.now()
      && Date.now() - new Date(existing.created_at).getTime() < THROTTLE_MS) {
    return NextResponse.json({ twoFactorRequired: true, throttled: true });
  }

  // Jenere kòd 6 chif sekirize, sere hash la, voye imèl la
  const code = String(crypto.randomInt(100000, 1000000));
  const { error: upErr } = await admin.from('login_codes').upsert({
    user_id: user.id,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  });
  if (upErr) return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });

  const r = await sendLoginCodeEmail({ to: user.email, code });
  if (!r.sent) {
    console.error('[2fa] imèl kòd pa pati:', r.error);
    return NextResponse.json({ error: 'Pa ka voye kòd la. Eseye ankò.' }, { status: 502 });
  }

  return NextResponse.json({ twoFactorRequired: true });
}