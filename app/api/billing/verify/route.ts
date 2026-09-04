// app/api/billing/verify/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { fulfillOrderIfPaid } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { ref } = await req.json().catch(() => ({ ref: undefined }));

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabaseAdmin
    .from('payment_requests')
    .select('id, business_id, plan, amount, status, bazik_order_id')
    .eq('business_id', user.id)        // sekirite: sèlman pwòp lòd itilizatè a
    .eq('provider', 'moncash_auto');

  if (ref) query = query.eq('reference_id', ref);
  else query = query.order('created_at', { ascending: false });

  const { data: row } = await query.limit(1).maybeSingle();

  if (!row) return NextResponse.json({ active: false, note: 'no order' });
  if (row.status === 'approved') return NextResponse.json({ active: true });

  try {
    const result = await fulfillOrderIfPaid(supabaseAdmin, row);
    return NextResponse.json({ active: result.ok && result.activated, note: result.reason });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erè enkoni';
    return NextResponse.json({ active: false, error: message }, { status: 500 });
  }
}