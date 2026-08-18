import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// ---- BAY LIS MANM BIZNIS LA (sèlman mèt) ----
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Ou pa otorize.' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verifye ki moun k ap mande
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Sesyon envalid.' }, { status: 401 });
  }

  // Jwenn biznis li ak wòl li
  const { data: membership } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', userData.user.id)
    .single();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Sèlman mèt biznis la ka wè lis la.' }, { status: 403 });
  }

  // Bay lis tout manm biznis la
  const { data: members, error: listError } = await admin
    .from('business_users')
    .select('id, user_id, role, full_name, created_at')
    .eq('business_id', membership.business_id)
    .order('created_at');

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({ members });
}

// ---- AJOUTE YON KESYE (sèlman mèt) ----
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Ou pa otorize.' }, { status: 401 });
  }

  const { email, password, full_name } = await req.json();

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Tout chan yo obligatwa.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Modpas la dwe gen omwen 6 karaktè.' }, { status: 400 });
  }

  // Kliyan ak SERVICE ROLE — dwa admin sou sèvè a
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1) Verifye ki moun k ap fè demann nan (ak token li)
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Sesyon envalid.' }, { status: 401 });
  }
  const requesterId = userData.user.id;

  // 2) Verifye ke moun sa a se yon OWNER (sèlman mèt ka ajoute kesye)
  const { data: membership } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', requesterId)
    .single();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Sèlman mèt biznis la ka ajoute yon kesye.' }, { status: 403 });
  }

  const businessId = membership.business_id;

  // 3) Kreye kont Auth kesye a (san konekte l — admin.createUser)
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Erè pandan kreyasyon kont lan.' }, { status: 400 });
  }

  // 4) Ajoute kesye a nan business_users (business_id = id mèt la)
  const { error: buError } = await admin.from('business_users').insert({
    user_id: newUser.user.id,
    business_id: businessId,
    role: 'cashier',
    full_name,
  });

  if (buError) {
    return NextResponse.json({ error: 'Kont kreye men gen pwoblèm ak wòl la: ' + buError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Kesye ajoute ak siksè!' });
}

// ---- RETIRE YON KESYE (sèlman mèt) ----
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Ou pa otorize.' }, { status: 401 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: 'Itilizatè a pa espesifye.' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1) Verifye ki moun k ap fè demann nan
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Sesyon envalid.' }, { status: 401 });
  }
  const requesterId = userData.user.id;

  // 2) Verifye ke moun sa a se yon OWNER
  const { data: membership } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', requesterId)
    .single();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Sèlman mèt biznis la ka retire yon itilizatè.' }, { status: 403 });
  }

  // 3) Yon mèt PA ka retire tèt li
  if (user_id === requesterId) {
    return NextResponse.json({ error: 'Ou pa ka retire tèt ou.' }, { status: 400 });
  }

  // 4) Verifye ke moun n ap retire a fè pati MENM biznis la (sekirite)
  const { data: target } = await admin
    .from('business_users')
    .select('id, business_id, role')
    .eq('user_id', user_id)
    .single();

  if (!target || target.business_id !== membership.business_id) {
    return NextResponse.json({ error: 'Itilizatè sa a pa fè pati biznis ou.' }, { status: 403 });
  }

  // 5) Retire liy business_users la
  const { error: delBuError } = await admin
    .from('business_users')
    .delete()
    .eq('user_id', user_id)
    .eq('business_id', membership.business_id);

  if (delBuError) {
    return NextResponse.json({ error: 'Erè pandan retire aksè a: ' + delBuError.message }, { status: 500 });
  }

  // 6) Efase kont Auth la (konsa li pa ka konekte ankò)
  const { error: delAuthError } = await admin.auth.admin.deleteUser(user_id);
  if (delAuthError) {
    // Aksè a retire deja (etap 5), men kont Auth la pa efase. Nou siyale l.
    return NextResponse.json({ error: 'Aksè retire, men gen pwoblèm efase kont lan: ' + delAuthError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Itilizatè retire ak siksè.' });
}