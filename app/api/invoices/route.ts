import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = supabase
    .from('invoices')
    .select('*, client:clients(id, name, phone)')
    .eq('business_id', user.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const body = await req.json();
  const { client_id, niche_template = 'retail', issue_date, due_date, tax_rate = 0, notes, currency = 'HTG', metadata = {} } = body;

  const items = metadata.items || [];
  const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price: number }) =>
    sum + item.quantity * item.unit_price, 0);
  const tax_amount = subtotal * (tax_rate / 100);
  const total_amount = subtotal + tax_amount;

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      business_id: user.id,
      client_id: client_id || null,
      niche_template,
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      due_date: due_date || null,
      subtotal, tax_rate, tax_amount, total_amount,
      amount_paid: 0, notes, currency, metadata, status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}  
