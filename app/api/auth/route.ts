import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, password, business_name, owner_name, phone, niche } = await req.json();

  if (!email || !password || !business_name || !owner_name) {
    return NextResponse.json({ error: 'Tout chan obligatwa yo dwe ranpli.' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Erè enskripsyon.' }, { status: 400 });
  }

  const { error: bizError } = await supabase.from('businesses').insert({
    id: authData.user.id,
    email,
    business_name,
    owner_name,
    phone: phone ?? null,
    niche: niche ?? 'retail',
  });

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Kont kreye! Esè gratis 14 jou kòmanse jodi a.' });
}  
