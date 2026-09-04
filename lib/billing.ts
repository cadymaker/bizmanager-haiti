// lib/billing.ts
// Lojik pataje: re-verifye ak Bazik, tcheke montan, aktive lisans, voye imèl, make demann.
// Idanpotan + pwoteje kont doub tretman (webhook + verify an menm tan).
// Itilize pa webhook la AK endpoint verify la (yon sèl sous verite).
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyOrder } from '@/lib/bazik';
import { getPlan, type PlanId } from '@/lib/plans';
import { activateLicense } from '@/lib/license';
import { sendLicenseConfirmationEmail } from '@/lib/email';

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

  // Aktive lisans lan (idanpotan — mete menm valè yo)
  const expiry = await activateLicense(supabaseAdmin, row.business_id, plan.id as PlanId);

  // Klèm atomik: sèlman youn (webhook OSWA verify) reyisi pase pending → approved.
  // Sa anpeche doub imèl si tou de rive an menm tan.
  const { data: claimed } = await supabaseAdmin
    .from('payment_requests')
    .update({
      status: 'approved',
      paid_at: new Date().toISOString(),
      ...(eventId ? { bazik_event_id: eventId } : {}),
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id');

  const didClaim = Array.isArray(claimed) && claimed.length > 0;
  if (!didClaim) {
    // Yon lòt pwosesis deja fini l — lisans lan aktive kanmenm
    return { ok: true, activated: false, reason: 'already processed (race)' };
  }

  // Voye imèl konfimasyon — PA janm bloke aktivasyon an si imèl la echwe
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.business_id);
    const to = userData?.user?.email;
    if (to) {
      const emailRes = await sendLicenseConfirmationEmail({
        to,
        planLabel: plan.label,
        amount: plan.amount,
        expiryDate: expiry,
      });
      if (!emailRes.sent) console.error('[billing] imèl pa pati:', emailRes.error);
    }
  } catch (e) {
    console.error('[billing] erè imèl:', e);
  }

  return { ok: true, activated: true, reason: 'activated' };
}