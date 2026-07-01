import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { data: admin } = await supabase
    .from('businesses').select('is_admin').eq('id', user.id).single();
  if (!admin?.is_admin) return NextResponse.json({ error: 'Aksè refize' }, { status: 403 });

  const { businessId } = await req.json();
  if (!businessId) return NextResponse.json({ error: 'ID manke' }, { status: 400 });

  // Anpeche admin revoke pwòp lisans li
  if (businessId === user.id) {
    return NextResponse.json({ error: 'Ou pa ka revoke pwòp lisans ou.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('businesses')
    .update({ license_status: 'expired', license_expiry_date: null })
    .eq('id', businessId);

  if (error) return NextResponse.json({ error: 'Echèk: ' + error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: 'Lisans revoke ak siksè!' });
}