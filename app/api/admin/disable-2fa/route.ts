import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Pa otorize', status: 401 as const };
  const { data: { user } } = await anon().auth.getUser(token);
  if (!user) return { error: 'Sesyon envalid', status: 401 as const };
  const admin = adminClient();
  const { data: me } = await admin.from('businesses').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return { error: 'Aksè refize', status: 403 as const };
  return { admin };
}

// Lis biznis ki gen 2FA aktif
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { data } = await gate.admin.from('business_users').select('business_id').eq('two_factor_email', true);
  const ids = Array.from(new Set((data ?? []).map((r) => r.business_id)));
  return NextResponse.json({ enabledBusinessIds: ids });
}

// Dezaktive 2FA pou yon biznis (rekiperasyon)
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { businessId } = await req.json();
  if (!businessId) return NextResponse.json({ error: 'ID manke' }, { status: 400 });

  const { error } = await gate.admin
    .from('business_users')
    .update({ two_factor_email: false })
    .eq('business_id', businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await gate.admin.from('login_codes').delete().eq('user_id', businessId);
  return NextResponse.json({ ok: true });
}