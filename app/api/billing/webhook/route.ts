// app/api/billing/webhook/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/bazik';
import { fulfillOrderIfPaid } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // kò BRIT — obligatwa pou siyati a
  const signature = req.headers.get('x-bazik-signature');
  const timestamp = req.headers.get('x-bazik-timestamp');
  const eventId = req.headers.get('x-bazik-event-id');

  const valid = verifyWebhookSignature({ rawBody, timestamp, eventId, signatureHeader: signature });
  if (!valid) {
    return NextResponse.json({ error: 'Siyati envalid' }, { status: 401 });
  }

  let event: { type?: string; orderId?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON envalid' }, { status: 400 });
  }

  if ((event.type ?? '') !== 'payment.succeeded') {
    return NextResponse.json({ received: true }); // lòt evènman → aksepte
  }
  if (!event.orderId) {
    return NextResponse.json({ error: 'orderId manke' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: row } = await supabaseAdmin
    .from('payment_requests')
    .select('id, business_id, plan, amount, status, bazik_order_id')
    .eq('bazik_order_id', event.orderId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ received: true, note: 'unknown order' }); // 200 pou sispann reesè
  }

  try {
    const result = await fulfillOrderIfPaid(supabaseAdmin, row, eventId);
    if (!result.ok && result.status >= 500) {
      return NextResponse.json({ error: result.reason }, { status: 500 }); // 5xx → Bazik reeseye
    }
    return NextResponse.json({ received: true, note: result.reason });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erè enkoni';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}