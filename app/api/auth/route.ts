import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, password, business_name, owner_name, phone, niche } = await req.json();

  if (!email || !password || !business_name || !owner_name) {
    return NextResponse.json({ error: 'Tout chan obligatwa yo dwe ranpli.' }, { status: 400 });
  }

  // Kliyan ak SERVICE ROLE — dwa admin sou sèvè a (pa janm ekspoze nan navigatè).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // 1) Kreye kont Auth la ak metòd ADMIN.
  //    Diferans ak signUp: sa a PA konekte nouvo itilizatè a, kidonk kliyan an
  //    rete service role pou tout rès operasyon yo (enpòtan pou business_users).
  //    email_confirm: true → itilizatè a ka konekte san konfime imèl (jan signUp te ye a).
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Erè enskripsyon.' }, { status: 400 });
  }

  const userId = authData.user.id;

  // 2) Kreye biznis la (id = user.id, jan li te ye anvan)
  const { error: bizError } = await supabase.from('businesses').insert({
    id: userId,
    email,
    business_name,
    owner_name,
    phone: phone ?? null,
    niche: niche ?? 'retail',
  });

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  // 3) Ajoute mèt la kòm "owner" nan business_users
  const { error: buError } = await supabase.from('business_users').insert({
    user_id: userId,
    business_id: userId, // pou yon mèt, business_id = pwòp user.id li
    role: 'owner',
    full_name: owner_name,
  });

  if (buError) {
    return NextResponse.json({ error: 'Kont kreye men gen yon pwoblèm ak wòl la: ' + buError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Kont kreye! Esè gratis 14 jou kòmanse jodi a.' });
}