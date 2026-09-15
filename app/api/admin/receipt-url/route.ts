import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Sèlman admin
  const { data: me } = await admin.from('businesses').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Aksè refize' }, { status: 403 });

  const { path } = await req.json();
  if (!path) return NextResponse.json({ error: 'Chemen manke' }, { status: 400 });

  // Ekstrè chemen an nan bucket la si se yon URL konplè yo voye
  let objectPath = String(path);
  const marker = '/receipts/';
  if (objectPath.includes(marker)) {
    objectPath = objectPath.split(marker)[1].split('?')[0];
  }

  const { data, error } = await admin.storage
    .from('receipts')
    .createSignedUrl(objectPath, 300); // valab 5 minit
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl });
}