// lib/billing.ts
// Lojik pataje: re-verifye ak Bazik, tcheke montan, aktive lisans, make demann.
// Idanpotan. Itilize pa webhook la AK endpoint verify la (yon sèl sous verite).
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyOrder } from '@/lib/bazik';
import { getPlan, type PlanId } from '@/lib/plans';
import { activateLicense } from '@/lib/license';

export interface PaymentRow {
  id: string;
  business_id: string;
  plan: string;
  amount: number;
  status: string;
  bazik_order_id: string | null;
}

export type FulfillResult =
  | { ok: true; activated: boolean; reason: string }
  | { ok: false; status: number; reason: string };

export async function fulfillOrderIfPaid(
  supabaseAdmin: SupabaseClient,
  row: PaymentRow,
  eventId?: string | null
): Promise<FulfillResult> {
  if (row.status === 'approved') {
    return { ok: true, activated: false, reason: 'already processed' };
  }
  if (!row.bazik_order_id) {
    return { ok: false, status: 400, reason: 'no bazik_order_id' };
  }

  const plan = getPlan(row.plan);
  if (!plan) {
    return { ok: false, status: 500, reason: 'invalid plan on order' };
  }

  // PA fè konfyans nan anyen — re-verifye dirèkteman ak Bazik
  const order = await verifyOrder(row.bazik_order_id);
  if (order.status !== 'successful') {
    return { ok: true, activated: false, reason: `not paid (status=${order.status})` };
  }

  // Verifye montan an (defans kont manipilasyon)
  if (typeof order.amount === 'number' && order.amount !== plan.amount) {
    return { ok: false, status: 400, reason: 'amount mismatch' };
  }

  // Aktive (menm bagay ak apwobasyon admin) + make demann lan
  await activateLicense(supabaseAdmin, row.business_id, plan.id as PlanId);
  await supabaseAdmin
    .from('payment_requests')
    .update({
      status: 'approved',
      paid_at: new Date().toISOString(),
      ...(eventId ? { bazik_event_id: eventId } : {}),
    })
    .eq('id', row.id);

  return { ok: true, activated: true, reason: 'activated' };
}