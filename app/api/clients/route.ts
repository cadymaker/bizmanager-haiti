import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyDebt = searchParams.get('filter') === 'debt';

  let query = supabase.from('clients').select('*').eq('business_id', user.id).order('name');
  if (onlyDebt) query = query.gt('total_debt', 0);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const { name, phone, address, email, notes } = await req.json();
  if (!name) return NextResponse.json({ error: 'Non kliyan obligatwa' }, { status: 400 });

  const { data, error } = await supabase
    .from('clients')
    .insert({ business_id: user.id, name, phone, address, email, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}  
