// app/api/billing/webhook/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, verifyOrder } from '@/lib/bazik';
import { getPlan, type PlanId } from '@/lib/plans';
import { activateLicense } from '@/lib/license';

export const runtime = 'nodejs'; // nou bezwen `crypto`

export async function POST(req: NextRequest) {
  // 1) Li kò BRIT la (PA req.json()) — siyati a kalkile sou li
  const rawBody = await req.text();
  const signature = req.headers.get('x-bazik-signature');
  const timestamp = req.headers.get('x-bazik-timestamp');
  const eventId = req.headers.get('x-bazik-event-id');

  // 2) Verifye siyati a anvan nou fè konfyans nan anyen
  const valid = verifyWebhookSignature({ rawBody, timestamp, eventId, signatureHeader: signature });
  if (!valid) {
    return NextResponse.json({ error: 'Siyati envalid' }, { status: 401 });
  }

  // 3) Analiz apre verifikasyon
  let event: { type?: string; orderId?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON envalid' }, { status: 400 });
  }

  const type = event.type ?? '';
  const orderId = event.orderId;

  // Nou okipe sèlman peman ki reyisi. Lòt evènman yo → 200 (aksepte, pa fè anyen)
  if (type !== 'payment.succeeded') {
    return NextResponse.json({ received: true });
  }
  if (!orderId) {
    return NextResponse.json({ error: 'orderId manke' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 4) Jwenn demann lan pa orderId Bazik la
  const { data: request } = await supabaseAdmin
    .from('payment_requests')
    .select('id, business_id, plan, amount, status, provider')
    .eq('bazik_order_id', orderId)
    .single();

  if (!request) {
    // Nou pa rekonèt lòd sa a — 200 pou Bazik sispann reeseye
    return NextResponse.json({ received: true, note: 'unknown order' });
  }

  // 5) Idanpotans — si li deja trete, pa refè l
  if (request.status === 'approved') {
    return NextResponse.json({ received: true, note: 'already processed' });
  }

  // 6) PA fè konfyans nan kò webhook la — re-verifye dirèkteman ak Bazik
  const order = await verifyOrder(orderId);
  if (order.status !== 'successful') {
    return NextResponse.json({ received: true, note: 'not paid yet' });
  }

  // 7) Verifye montan an kòrèk (defans kont manipilasyon)
  const plan = getPlan(request.plan);
  if (!plan) {
    return NextResponse.json({ error: 'Plan envalid nan demann lan' }, { status: 500 });
  }
  if (typeof order.amount === 'number' && order.amount !== plan.amount) {
    return NextResponse.json({ error: 'Montan pa koresponn' }, { status: 400 });
  }

  // 8) Aktive lisans lan (menm bagay ak apwobasyon admin) + make demann lan
  try {
    await activateLicense(supabaseAdmin, request.business_id, plan.id as PlanId);
    await supabaseAdmin
      .from('payment_requests')
      .update({
        status: 'approved',
        paid_at: new Date().toISOString(),
        bazik_event_id: eventId,
      })
      .eq('id', request.id);
  } catch (e) {
    // Erè sèvè → 500 pou Bazik reeseye (1/5/15 min)
    const message = e instanceof Error ? e.message : 'erè enkoni';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}