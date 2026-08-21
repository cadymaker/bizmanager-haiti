import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // ===== 1) Verifye sesyon an =====
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Pa gen otorizasyon.' }, { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: 'Sesyon envalid.' }, { status: 401 });
    }

    const { reason, note, confirmName } = await req.json();
    if (!reason) {
      return NextResponse.json({ error: 'Chwazi yon rezon.' }, { status: 400 });
    }

    // ===== 2) Jwenn biznis la — SÈLMAN mèt la ka efase =====
    // Nan sistèm nan, businesses.id = ID kont mèt la.
    const { data: biz } = await supabaseAdmin
      .from('businesses')
      .select('id, business_name, owner_name, email, phone, niche, license_status, is_admin, created_at')
      .eq('id', user.id)
      .single();

    if (!biz) {
      return NextResponse.json(
        { error: 'Sèlman mèt biznis la ka efase kont lan.' },
        { status: 403 }
      );
    }

    if (biz.is_admin) {
      return NextResponse.json(
        { error: 'Yon kont admin pa ka efase tèt li.' },
        { status: 400 }
      );
    }

    if (confirmName !== biz.business_name) {
      return NextResponse.json({ error: 'Non biznis la pa matche.' }, { status: 400 });
    }

    const businessId = biz.id;

    // ===== 3) Sove rezon an AVAN efasman =====
    await supabaseAdmin.from('deletion_feedback').insert({
      business_id: businessId,
      business_name: biz.business_name,
      owner_name: biz.owner_name,
      email: biz.email,
      phone: biz.phone,
      niche: biz.niche,
      license_status: biz.license_status,
      reason: reason,
      note: (note ?? '').trim() || null,
      account_created_at: biz.created_at,
    });

    // ===== 4) Ranmase manm yo AVAN cascade =====
    const { data: members } = await supabaseAdmin
      .from('business_users')
      .select('user_id')
      .eq('business_id', businessId);
    const memberIds = (members ?? []).map((m: any) => m.user_id);

    // ===== 5) Efase fichye Storage yo =====
    for (const bucket of ['logos', 'products']) {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(businessId, { limit: 1000 });
      if (files && files.length > 0) {
        await supabaseAdmin.storage
          .from(bucket)
          .remove(files.map((f: any) => `${businessId}/${f.name}`));
      }
    }

    // ===== 6) Efase biznis la (CASCADE efase tout done yo) =====
    const { error: delErr } = await supabaseAdmin
      .from('businesses')
      .delete()
      .eq('id', businessId);

    if (delErr) {
      return NextResponse.json(
        { error: 'Erè efasman: ' + delErr.message },
        { status: 500 }
      );
    }

    // ===== 7) Efase kont Auth yo =====
    const authIds = new Set<string>([businessId]);
    for (const uid of memberIds) {
      if (uid === businessId) continue;
      const { data: otherLinks } = await supabaseAdmin
        .from('business_users')
        .select('id')
        .eq('user_id', uid)
        .limit(1);
      if (!otherLinks || otherLinks.length === 0) authIds.add(uid);
    }

    for (const uid of authIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    return NextResponse.json({ message: 'Kont lan efase nèt.' });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erè sèvè: ' + (err?.message ?? 'enkoni') },
      { status: 500 }
    );
  }
}