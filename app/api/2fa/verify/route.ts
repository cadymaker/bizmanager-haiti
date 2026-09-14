import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  const secret = process.env.LICENSE_SECRET_KEY ?? 'bzm-fallback';
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

function decodeSessionId(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
    return payload.session_id ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const sessionId = decodeSessionId(token);
  if (!sessionId) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { code } = await req.json();
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Kòd la dwe gen 6 chif.' }, { status: 400 });
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row } = await admin
    .from('login_codes').select('code_hash, expires_at, attempts').eq('user_id', user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Pa gen kòd aktif. Mande yon nouvo kòd.' }, { status: 400 });

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from('login_codes').delete().eq('user_id', user.id);
    return NextResponse.json({ error: 'Kòd la ekspire. Mande yon nouvo kòd.' }, { status: 400 });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await admin.from('login_codes').delete().eq('user_id', user.id);
    return NextResponse.json({ error: 'Twòp tantativ. Mande yon nouvo kòd.' }, { status: 429 });
  }

  // Konparezon ki sekirize kont atak sou tan
  const a = Buffer.from(hashCode(String(code)));
  const b = Buffer.from(row.code_hash);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    await admin.from('login_codes').update({ attempts: row.attempts + 1 }).eq('user_id', user.id);
    return NextResponse.json({ error: 'Kòd la pa kòrèk.' }, { status: 400 });
  }

  // Siksè: konsome kòd la + make sesyon an kòm verifye
  await admin.from('login_codes').delete().eq('user_id', user.id);
  await admin.from('verified_2fa_sessions').upsert({
    session_id: sessionId, user_id: user.id, verified_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}