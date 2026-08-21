import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // ===== 1) Verifye moun k ap mande a se yon admin =====
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Pa gen otorizasyon.' }, { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: 'Sesyon envalid.' }, { status: 401 });
    }

    const { data: me } = await supabaseAdmin
      .from('businesses')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!me?.is_admin) {
      return NextResponse.json({ error: 'Aksè refize — ou pa yon admin.' }, { status: 403 });
    }

    // ===== 2) Li paramèt yo =====
    const { businessId, confirmName } = await req.json();
    if (!businessId) {
      return NextResponse.json({ error: 'businessId manke.' }, { status: 400 });
    }

    const { data: target } = await supabaseAdmin
      .from('businesses')
      .select('id, business_name, is_admin')
      .eq('id', businessId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'Biznis la pa jwenn.' }, { status: 404 });
    }

    // Pwoteksyon: pa ka efase yon kont admin
    if (target.is_admin) {
      return NextResponse.json({ error: 'Ou pa ka efase yon kont admin.' }, { status: 400 });
    }

    // Pwoteksyon: pa ka efase pwòp kont ou
    if (target.id === user.id) {
      return NextResponse.json({ error: 'Ou pa ka efase pwòp kont ou.' }, { status: 400 });
    }

    // Pwoteksyon: non an dwe matche egzakteman
    if (confirmName !== target.business_name) {
      return NextResponse.json({ error: 'Non biznis la pa matche.' }, { status: 400 });
    }

    // ===== 3) Jwenn itilizatè yo AVAN efasman (cascade ap efase business_users) =====
    const { data: members } = await supabaseAdmin
      .from('business_users')
      .select('user_id, business_id')
      .eq('business_id', businessId);

    const memberIds = (members ?? []).map((m: any) => m.user_id);

    // ===== 4) Efase fichye nan Storage =====
    for (const bucket of ['logos', 'products']) {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(businessId, { limit: 1000 });

      if (files && files.length > 0) {
        const paths = files.map((f: any) => `${businessId}/${f.name}`);
        await supabaseAdmin.storage.from(bucket).remove(paths);
      }
    }

    // ===== 5) Efase biznis la (CASCADE efase tout done ki mare yo) =====
    const { error: delErr } = await supabaseAdmin
      .from('businesses')
      .delete()
      .eq('id', businessId);

    if (delErr) {
      return NextResponse.json({ error: 'Erè efasman: ' + delErr.message }, { status: 500 });
    }

    // ===== 6) Efase kont Auth yo =====
    // Mèt la: ID biznis lan = ID kont li
    const authIdsToDelete = new Set<string>([businessId]);

    // Kesye yo: efase sèlman si yo pa fè pati yon lòt biznis
    for (const uid of memberIds) {
      if (uid === businessId) continue;
      const { data: otherLinks } = await supabaseAdmin
        .from('business_users')
        .select('id')
        .eq('user_id', uid)
        .limit(1);
      if (!otherLinks || otherLinks.length === 0) {
        authIdsToDelete.add(uid);
      }
    }

    let deletedUsers = 0;
    for (const uid of authIdsToDelete) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (!error) deletedUsers++;
    }

    return NextResponse.json({
      message: `Biznis "${target.business_name}" efase nèt (${deletedUsers} kont itilizatè retire).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erè sèvè: ' + (err?.message ?? 'enkoni') },
      { status: 500 }
    );
  }
}