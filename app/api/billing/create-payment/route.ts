// app/api/billing/create-payment/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPlan } from '@/lib/plans';
import { createMonCashPayment } from '@/lib/bazik';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Pa otorize' }, { status: 401 });

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesyon envalid' }, { status: 401 });

  const { plan: planId } = await req.json();
  const plan = getPlan(planId);
  if (!plan) return NextResponse.json({ error: 'Plan envalid' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: 'Konfigirasyon sèvè a pa konplè (APP_URL)' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const referenceId = `BZM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('payment_requests')
    .insert({
      business_id: user.id,
      plan: plan.id,
      amount: plan.amount,
      duration: plan.durationLabel,
      payment_method: 'moncash',
      provider: 'moncash_auto',
      reference_id: referenceId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: 'Echèk kreyasyon demann: ' + (insErr?.message ?? '') }, { status: 500 });
  }

  try {
    const payment = await createMonCashPayment({
      gdes: plan.amount,
      referenceId,
      description: `BizManager - lisans ${plan.label}`,
      customerEmail: user.email ?? undefined,
      successUrl: `${appUrl}/subscribe/success?ref=${encodeURIComponent(referenceId)}`,
      errorUrl: `${appUrl}/subscribe/error`,
      webhookUrl: `${appUrl}/api/billing/webhook`,
      metadata: { requestId: inserted.id, businessId: user.id, plan: plan.id },
    });

    await supabaseAdmin
      .from('payment_requests')
      .update({ bazik_order_id: payment.orderId })
      .eq('id', inserted.id);

    return NextResponse.json({ redirectUrl: payment.redirectUrl, orderId: payment.orderId });
  } catch (e) {
    await supabaseAdmin.from('payment_requests').delete().eq('id', inserted.id);
    const err = e as { message?: string; status?: number; body?: unknown };
    // Vizib tou nan Vercel → Logs (Runtime)
    console.error('[create-payment] Bazik error', {
      status: err.status,
      body: err.body,
      message: err.message,
    });
    const detail =
      err.body && typeof err.body === 'object' && Object.keys(err.body as object).length
        ? JSON.stringify(err.body)
        : err.message ?? 'erè enkoni';
    return NextResponse.json(
      { error: `Bazik (HTTP ${err.status ?? '?'}): ${detail}` },
      { status: 502 }
    );
  }
}