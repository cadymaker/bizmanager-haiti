// app/api/cron/reminders/route.ts
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendExpiryReminderEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY = 86400000;

async function getEmail(admin: SupabaseClient, businessId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(businessId);
  return data?.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  // Vercel Cron voye Authorization: Bearer <CRON_SECRET> otomatikman
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const trialStartMin = new Date(now.getTime() - 14 * DAY); // tès fini nan ~2 jou
  const trialStartMax = new Date(now.getTime() - 12 * DAY);
  const planMax = new Date(now.getTime() + 3 * DAY);        // abònman fini nan 3 jou

  let trialsSent = 0, plansSent = 0, failures = 0;

  // ── Tès ki ap fini byento (poko peye) ──
  const { data: trials } = await admin
    .from('businesses')
    .select('id, trial_start_date')
    .or('license_status.is.null,license_status.neq.active')
    .gte('trial_start_date', trialStartMin.toISOString())
    .lte('trial_start_date', trialStartMax.toISOString())
    .eq('trial_reminder_sent', false);

  for (const b of trials ?? []) {
    try {
      const email = await getEmail(admin, b.id);
      if (!email) continue;
      const trialEnd = new Date(new Date(b.trial_start_date).getTime() + 14 * DAY);
      const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / DAY));
      const res = await sendExpiryReminderEmail({ to: email, kind: 'trial', daysLeft });
      if (res.sent) {
        await admin.from('businesses').update({ trial_reminder_sent: true }).eq('id', b.id);
        trialsSent++;
      } else { failures++; console.error('[cron] trial email fail', b.id, res.error); }
    } catch (e) { failures++; console.error('[cron] trial error', b.id, e); }
  }

  // ── Abònman peye ki ap fini byento ──
  const { data: plans } = await admin
    .from('businesses')
    .select('id, license_expiry_date')
    .eq('license_status', 'active')
    .gte('license_expiry_date', now.toISOString())
    .lte('license_expiry_date', planMax.toISOString())
    .eq('expiry_reminder_sent', false);

  for (const b of plans ?? []) {
    try {
      const email = await getEmail(admin, b.id);
      if (!email) continue;
      const expiry = new Date(b.license_expiry_date);
      const daysLeft = Math.max(1, Math.ceil((expiry.getTime() - now.getTime()) / DAY));
      const res = await sendExpiryReminderEmail({ to: email, kind: 'plan', daysLeft });
      if (res.sent) {
        await admin.from('businesses').update({ expiry_reminder_sent: true }).eq('id', b.id);
        plansSent++;
      } else { failures++; console.error('[cron] plan email fail', b.id, res.error); }
    } catch (e) { failures++; console.error('[cron] plan error', b.id, e); }
  }

  return NextResponse.json({ ok: true, trialsSent, plansSent, failures });
}