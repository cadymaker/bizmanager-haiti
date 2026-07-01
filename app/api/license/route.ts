import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validateActivationCode, calcExpiryDate, getLicenseInfo } from '@/lib/license';
import crypto from 'crypto';

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '');
}

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Kòd obligatwa' }, { status: 400 });

  const { data: business } = await supabase
    .from('businesses')
    .select('id, license_status, activation_code_hash')
    .eq('id', user.id)
    .single();

  if (!business) return NextResponse.json({ error: 'Biznis pa jwenn' }, { status: 404 });

  const codeHash = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  if (business.activation_code_hash === codeHash) {
    return NextResponse.json({ error: 'Kòd sa a deja itilize.' }, { status: 409 });
  }

  const duration = validateActivationCode(business.id, code);
  if (!duration) return NextResponse.json({ error: 'Kòd aktivasyon envalid.' }, { status: 400 });

  const expiryDate = calcExpiryDate(duration);

  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      license_status: 'active',
      license_expiry_date: expiryDate.toISOString(),
      activation_code_hash: codeHash,
    })
    .eq('id', business.id);

  if (updateError) return NextResponse.json({ error: 'Echèk aktivasyon' }, { status: 500 });

  return NextResponse.json({
    success: true,
    duration,
    expiry_date: expiryDate.toISOString(),
    message: duration === '30days' ? 'Lisans aktive pou 30 jou!' : 'Lisans aktive pou 1 an!',
  });
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { data: business } = await supabase
    .from('businesses')
    .select('trial_start_date, license_status, license_expiry_date')
    .eq('id', user.id)
    .single();

  if (!business) return NextResponse.json({ error: 'Pa jwenn' }, { status: 404 });
  return NextResponse.json(getLicenseInfo(business));
}