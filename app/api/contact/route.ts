import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, business_name, message } = await req.json();

    // Validasyon debaz
    if (!name || String(name).trim().length < 2) {
      return NextResponse.json({ error: 'Antre non ou.' }, { status: 400 });
    }
    if (!message || String(message).trim().length < 10) {
      return NextResponse.json(
        { error: 'Ekri yon mesaj ki gen omwen 10 karaktè.' },
        { status: 400 }
      );
    }
    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Bay yon telefòn oswa yon imèl pou nou ka reponn ou.' },
        { status: 400 }
      );
    }

    // Limit longè (pwoteksyon kont abi)
    const clip = (v: any, max: number) =>
      v ? String(v).trim().slice(0, max) : null;

    const { error } = await supabaseAdmin.from('contact_messages').insert({
      name: clip(name, 120),
      phone: clip(phone, 40),
      email: clip(email, 160),
      business_name: clip(business_name, 160),
      message: String(message).trim().slice(0, 2000),
    });

    if (error) {
      return NextResponse.json({ error: 'Pa ka voye mesaj la.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Mesaj voye.' });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}