import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const MONTH_LABELS = ['Jan', 'Fev', 'Mas', 'Avr', 'Me', 'Jen', 'Jiy', 'Out', 'Sep', 'Okt', 'Nov', 'Des'];

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Pa otorize', status: 401 as const };
  const { data: { user } } = await anon().auth.getUser(token);
  if (!user) return { error: 'Sesyon envalid', status: 401 as const };
  const admin = adminClient();
  const { data: me } = await admin.from('businesses').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return { error: 'Aksè refize', status: 403 as const };
  return { admin };
}

// Rale tout liy yo pa pakè 1000
async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<T[]> {
  const size = 1000;
  let from = 0;
  const out: T[] = [];
  while (true) {
    const { data, error } = await make(from, from + size - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
    from += size;
  }
  return out;
}

function monthsOf(plan: string): number {
  if (plan === '1year') return 12;
  if (plan === '90days') return 3;
  return 1;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = gate.admin;

  const now = Date.now();
  const today = new Date();

  // ===== Done =====
  const allBiz = await fetchAll<any>((f, t) =>
    admin
      .from('businesses')
      .select('id, business_name, owner_name, phone, is_admin, license_status, trial_start_date, license_expiry_date, created_at')
      .order('created_at')
      .range(f, t)
  );
  const bizs = allBiz.filter(b => !b.is_admin);
  const bizIds = new Set(bizs.map(b => b.id));

  const pays = (await fetchAll<any>((f, t) =>
    admin
      .from('payment_requests')
      .select('business_id, plan, amount, status, paid_at, reviewed_at, created_at')
      .eq('status', 'approved')
      .order('created_at')
      .range(f, t)
  )).filter(p => bizIds.has(p.business_id));

  const since7 = new Date(now - 6 * DAY).toISOString().slice(0, 10);
  const inv7 = await fetchAll<any>((f, t) =>
    admin
      .from('invoices')
      .select('business_id')
      .gte('issue_date', since7)
      .in('status', ['sent', 'partial', 'paid'])
      .order('id')
      .range(f, t)
  );

  // ===== Estati biznis yo =====
  const trialEnd = (b: any) =>
    b.trial_start_date ? new Date(b.trial_start_date).getTime() + 14 * DAY : 0;
  const expiry = (b: any) =>
    b.license_expiry_date ? new Date(b.license_expiry_date).getTime() : 0;
  const licenseActive = (b: any) => b.license_status === 'active' && expiry(b) > now;
  const inTrial = (b: any) => !licenseActive(b) && trialEnd(b) > now;

  // "Peye" = omwen yon peman apwouve. Yon kòd aktivasyon (gratis) PA konte kòm peman.
  const paidBizIds = new Set(pays.map(p => p.business_id));
  const hasPaid = (b: any) => paidBizIds.has(b.id);

  const activeLicenses = bizs.filter(licenseActive);
  const trials = bizs.filter(inTrial);
  const expired = bizs.filter(b => !licenseActive(b) && !inTrial(b));
  const newSignups30 = bizs.filter(b => b.created_at && new Date(b.created_at).getTime() >= now - 30 * DAY);

  // Te peye deja, men lisans lan ekspire
  const notRenewed = bizs.filter(b => hasPaid(b) && !licenseActive(b) && b.license_expiry_date && expiry(b) <= now);

  // Aktive ak kòd (san peman), epi kòd la fini
  const freeCodeExpired = bizs.filter(b => !hasPaid(b) && !licenseActive(b) && b.license_expiry_date && expiry(b) <= now);

  // Konvèsyon: sou biznis ki fin esè 14 jou yo, kiyès ki fè yon peman reyèl
  const trialEnded = bizs.filter(b => trialEnd(b) > 0 && trialEnd(b) <= now);
  const converted = trialEnded.filter(hasPaid);
  const conversionRate = trialEnded.length > 0 ? (converted.length / trialEnded.length) * 100 : null;

  // ===== Biznis aktif (omwen 1 vant nan 7 jou) =====
  const active7 = new Set(inv7.map(i => i.business_id).filter(id => bizIds.has(id)));
  const usable = activeLicenses.length + trials.length;

  // ===== Revni =====
  const payDate = (p: any) => new Date(p.paid_at ?? p.reviewed_at ?? p.created_at);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  let revenueAllTime = 0;
  let revenueThisMonth = 0;
  let revenueLast30 = 0;
  pays.forEach(p => {
    const amt = Number(p.amount || 0);
    const t = payDate(p).getTime();
    revenueAllTime += amt;
    if (t >= startOfMonth) revenueThisMonth += amt;
    if (t >= now - 30 * DAY) revenueLast30 += amt;
  });

  // ===== MRR estime: dènye plan peye chak biznis ki gen lisans aktif =====
  const latestPay = new Map<string, any>();
  pays.forEach(p => {
    const prev = latestPay.get(p.business_id);
    if (!prev || payDate(p) > payDate(prev)) latestPay.set(p.business_id, p);
  });
  let mrr = 0;
  let freeCodeActive = 0;
  activeLicenses.forEach(b => {
    const p = latestPay.get(b.id);
    if (p) mrr += Number(p.amount || 0) / monthsOf(p.plan);
    else freeCodeActive++;
  });

  // ===== Seri 6 mwa (revni + enskripsyon) =====
  const series: { key: string; label: string; revenue: number; signups: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    series.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()], revenue: 0, signups: 0 });
  }
  const byKey = new Map(series.map(s => [s.key, s]));
  pays.forEach(p => {
    const s = byKey.get(monthKey(payDate(p)));
    if (s) s.revenue += Number(p.amount || 0);
  });
  bizs.forEach(b => {
    if (!b.created_at) return;
    const s = byKey.get(monthKey(new Date(b.created_at)));
    if (s) s.signups += 1;
  });

  // ===== Lis aksyon =====
  const pick = (b: any, days: number) => ({
    id: b.id,
    business_name: b.business_name,
    owner_name: b.owner_name,
    phone: b.phone,
    days,
    paid: hasPaid(b),
  });

  const expiringSoon = activeLicenses
    .filter(b => expiry(b) - now <= 7 * DAY)
    .map(b => pick(b, Math.max(0, Math.ceil((expiry(b) - now) / DAY))))
    .sort((a, b) => a.days - b.days);

  const trialsEndingSoon = trials
    .filter(b => trialEnd(b) - now <= 3 * DAY)
    .map(b => pick(b, Math.max(0, Math.ceil((trialEnd(b) - now) / DAY))))
    .sort((a, b) => a.days - b.days);

  const notRenewedList = notRenewed
    .map(b => pick(b, Math.floor((now - expiry(b)) / DAY)))
    .sort((a, b) => a.days - b.days)
    .slice(0, 10);

  const freeCodeExpiredList = freeCodeExpired
    .map(b => pick(b, Math.floor((now - expiry(b)) / DAY)))
    .sort((a, b) => a.days - b.days)
    .slice(0, 10);

  return NextResponse.json({
    mrr,
    freeCodeActive,
    revenue: { thisMonth: revenueThisMonth, last30: revenueLast30, allTime: revenueAllTime },
    businesses: {
      total: bizs.length,
      trials: trials.length,
      activeLicenses: activeLicenses.length,
      expired: expired.length,
      newSignups30: newSignups30.length,
      notRenewed: notRenewed.length,
    },
    activity: { active7: active7.size, usable },
    conversion: { rate: conversionRate, converted: converted.length, trialEnded: trialEnded.length },
    series,
    lists: {
      expiringSoon,
      trialsEndingSoon,
      notRenewed: notRenewedList,
      freeCodeExpired: freeCodeExpiredList,
    },
  });
}