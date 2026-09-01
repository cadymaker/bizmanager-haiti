import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Verifye moun k ap mande a se yon admin
async function requireAdmin(req: NextRequest) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!token) return { error: 'Pa gen otorizasyon.', status: 401 };

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return { error: 'Sesyon envalid.', status: 401 };

  const { data: me } = await supabaseAdmin
    .from('businesses')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!me?.is_admin) return { error: 'Aksè refize — ou pa yon admin.', status: 403 };
  return { user };
}

// Li feedback, rezon efasman, ak mesaj kontak yo
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data: feedback, error: fbErr } = await supabaseAdmin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (fbErr) {
    return NextResponse.json({ error: fbErr.message }, { status: 500 });
  }

  const { data: deletions } = await supabaseAdmin
    .from('deletion_feedback')
    .select('*')
    .order('deleted_at', { ascending: false })
    .limit(200);

  const { data: contacts } = await supabaseAdmin
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json({
    feedback: feedback ?? [],
    deletions: deletions ?? [],
    contacts: contacts ?? [],
  });
}

// Chanje estati yon feedback oswa yon mesaj kontak
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id, status, type } = await req.json();
  if (!id || !['new', 'read', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Paramèt envalid.' }, { status: 400 });
  }

  const table = type === 'contact' ? 'contact_messages' : 'feedback';

  const { error } = await supabaseAdmin
    .from(table)
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Estati chanje.' });
}