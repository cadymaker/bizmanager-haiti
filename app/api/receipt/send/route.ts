import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendReceiptEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.to) return NextResponse.json({ error: 'Imèl manke' }, { status: 400 });

  const r = await sendReceiptEmail(body);
  if (!r.sent) return NextResponse.json({ error: r.error ?? 'Pa ka voye' }, { status: 502 });
  return NextResponse.json({ ok: true });
}