import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ===== Limit pa IP (nan memwa) =====
// Nòt: sa reyinisyalize lè sèvè a rekòmanse. Se yon premye baryè,
// pa yon pwoteksyon absoli — men li rete efikas kont bot senp.
const RATE_LIMIT = 3;                    // maksimòm mesaj
const RATE_WINDOW_MS = 10 * 60 * 1000;   // pa 10 minit
const hits = new Map<string, number[]>();

function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'enkoni';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);

  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }

  list.push(now);
  hits.set(ip, list);

  // Netwaye antre ki vye (evite memwa a grandi san rete)
  if (hits.size > 5000) {
    Array.from(hits.entries()).forEach(([k, v]) => {
      if (v.every(t => now - t >= RATE_WINDOW_MS)) hits.delete(k);
    });
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Ou voye twòp mesaj. Tann kèk minit epi eseye ankò.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, phone, email, business_name, message, website } = body;

    // Honeypot: chan kache ki bot yo ranpli
    if (website) {
      // Nou fè kòm si tout bon, men nou pa sove anyen
      return NextResponse.json({ message: 'Mesaj voye.' });
    }

    // Validasyon
    if (!name || String(name).trim().length < 2) {
      return NextResponse.json({ error: 'Antre non ou.' }, { status: 400 });
    }
    if (!message || String(message).trim().length < 10) {
      return NextResponse.json(
        { error: 'Ekri yon mesaj ki gen omwen 10 karaktè.' },
        { status: 400 }
      );
    }
    if (String(message).trim().length > 2000) {
      return NextResponse.json(
        { error: 'Mesaj la twò long (maksimòm 2000 karaktè).' },
        { status: 400 }
      );
    }
    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Bay yon telefòn oswa yon imèl pou nou ka reponn ou.' },
        { status: 400 }
      );
    }

    // Verifye fòma imèl la si li bay youn
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return NextResponse.json({ error: 'Imèl la pa valab.' }, { status: 400 });
    }

    const clip = (v: any, max: number) =>
      v ? String(v).trim().slice(0, max) : null;

    const cleanMessage = String(message).trim().slice(0, 2000);

    // Anpeche menm mesaj la de fwa nan yon ti moman
    const tenMinAgo = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { data: dup } = await supabaseAdmin
      .from('contact_messages')
      .select('id')
      .eq('message', cleanMessage)
      .gte('created_at', tenMinAgo)
      .limit(1);

    if (dup && dup.length > 0) {
      // Nou fè kòm si tout bon — moun nan pa bezwen konnen
      return NextResponse.json({ message: 'Mesaj voye.' });
    }

    const { error } = await supabaseAdmin.from('contact_messages').insert({
      name: clip(name, 120),
      phone: clip(phone, 40),
      email: clip(email, 160),
      business_name: clip(business_name, 160),
      message: cleanMessage,
    });

    if (error) {
      return NextResponse.json({ error: 'Pa ka voye mesaj la.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Mesaj voye.' });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}