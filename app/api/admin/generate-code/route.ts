import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateActivationCode, LicenseDuration } from '@/lib/license';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { data: admin } = await supabase
    .from('businesses').select('is_admin').eq('id', user.id).single();
  if (!admin?.is_admin) return NextResponse.json({ error: 'Aksè refize' }, { status: 403 });

  const { businessId, duration } = await req.json() as { businessId: string; duration: LicenseDuration };
 if (!businessId || !['30days', '90days', '1year'].includes(duration)) {
    return NextResponse.json({ error: 'Done envalid' }, { status: 400 });
  }

  const { data: business } = await supabase
    .from('businesses').select('id, business_name').eq('id', businessId).single();
  if (!business) return NextResponse.json({ error: 'Biznis pa jwenn' }, { status: 404 });

  const code = generateActivationCode(businessId, duration);
  return NextResponse.json({ code, businessName: business.business_name, duration });
}