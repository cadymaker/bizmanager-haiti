import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: admin } = await supabaseAdmin
    .from('businesses').select('is_admin').eq('id', user.id).single();
  if (!admin?.is_admin) return NextResponse.json({ error: 'Aksè refize' }, { status: 403 });

  const { requestId, action } = await req.json();
  if (!requestId) return NextResponse.json({ error: 'ID manke' }, { status: 400 });

  const { data: request } = await supabaseAdmin
    .from('payment_requests')
    .select('id, business_id, plan, status')
    .eq('id', requestId)
    .single();

  if (!request) return NextResponse.json({ error: 'Demann pa jwenn' }, { status: 404 });
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Demann sa a deja trete.' }, { status: 409 });
  }

  if (action === 'reject') {
    await supabaseAdmin.from('payment_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);
    return NextResponse.json({ success: true, message: 'Demann refize.' });
  }

  const expiry = new Date();
  if (request.plan === '30days') expiry.setDate(expiry.getDate() + 30);
  else if (request.plan === '90days') expiry.setDate(expiry.getDate() + 90);
  else if (request.plan === '1year') expiry.setFullYear(expiry.getFullYear() + 1);
  else return NextResponse.json({ error: 'Plan envalid' }, { status: 400 });

  const { error: bizError } = await supabaseAdmin
    .from('businesses')
    .update({ license_status: 'active', license_expiry_date: expiry.toISOString() })
    .eq('id', request.business_id);
  if (bizError) return NextResponse.json({ error: 'Echèk aktivasyon: ' + bizError.message }, { status: 500 });

  await supabaseAdmin.from('payment_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', requestId);

  return NextResponse.json({ success: true, message: 'Lisans aktive ak siksè!' });
}