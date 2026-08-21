import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validateActivationCode, calcExpiryDate, getLicenseInfo } from '@/lib/license';
import crypto from 'crypto';

// Kliyan sèvè — kontoune RLS. Nou verifye idantite moun nan ak token an anvan.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '');
}

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  // Verifye token an → jwenn itilizatè a
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Kòd obligatwa' }, { status: 400 });

  const { data: business, error: bizErr } = await supabaseAdmin
    .from('businesses')
    .select('id, license_status, activation_code_hash')
    .eq('id', user.id)
    .single();

  if (bizErr || !business) {
    return NextResponse.json(
      { error: 'Biznis pa jwenn. Sèlman mèt biznis la ka aktive yon lisans.' },
      { status: 404 }
    );
  }

  const codeHash = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  if (business.activation_code_hash === codeHash) {
    return NextResponse.json({ error: 'Kòd sa a deja itilize.' }, { status: 409 });
  }

  const duration = validateActivationCode(business.id, code);
  if (!duration) return NextResponse.json({ error: 'Kòd aktivasyon envalid.' }, { status: 400 });

  const expiryDate = calcExpiryDate(duration);

  const { error: updateError } = await supabaseAdmin
    .from('businesses')
    .update({
      license_status: 'active',
      license_expiry_date: expiryDate.toISOString(),
      activation_code_hash: codeHash,
    })
    .eq('id', business.id);

  if (updateError) {
    return NextResponse.json({ error: 'Echèk aktivasyon: ' + updateError.message }, { status: 500 });
  }

  const durLabel =
    duration === '30days' ? '30 jou' :
    duration === '90days' ? '90 jou' :
    '1 an';

  return NextResponse.json({
    success: true,
    duration,
    expiry_date: expiryDate.toISOString(),
    message: `Lisans aktive pou ${durLabel}!`,
  });
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('trial_start_date, license_status, license_expiry_date')
    .eq('id', user.id)
    .single();

  if (!business) return NextResponse.json({ error: 'Pa jwenn' }, { status: 404 });
  return NextResponse.json(getLicenseInfo(business));
}