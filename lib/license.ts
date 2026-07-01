import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET_KEY!;
export const TRIAL_DAYS = 14;
export type LicenseDuration = '30days' | '90days' | '1year';

export function generateActivationCode(businessId: string, duration: LicenseDuration): string {
  const payload = `${businessId}:${duration}`;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(payload).digest('hex').substring(0, 8).toUpperCase();
  const shortId = businessId.replace(/-/g, '').substring(0, 8).toUpperCase();
  const durationCode = duration === '30days' ? '30D' : duration === '90days' ? '90D' : '1YR';
  return `${shortId}-${durationCode}-${hmac}`;
}

export function validateActivationCode(businessId: string, code: string): LicenseDuration | null {
  const cleaned = code.trim().toUpperCase();
  const parts = cleaned.split('-');
  if (parts.length < 3) return null;
  const durationCode = parts[parts.length - 2];
  const submittedHmac = parts[parts.length - 1];
  const duration: LicenseDuration | null =
    durationCode === '30D' ? '30days' :
    durationCode === '90D' ? '90days' :
    durationCode === '1YR' ? '1year' : null;
  if (!duration) return null;
  const payload = `${businessId}:${duration}`;
  const expectedHmac = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(payload).digest('hex').substring(0, 8).toUpperCase();
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedHmac),
      Buffer.from(expectedHmac)
    );
    return isValid ? duration : null;
  } catch {
    return null;
  }
}

export function getLicenseInfo(business: {
  trial_start_date: string;
  license_status: string;
  license_expiry_date?: string | null;
}) {
  const now = new Date();
  const trialStart = new Date(business.trial_start_date);
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  if (business.license_status === 'active' && business.license_expiry_date) {
    const expiry = new Date(business.license_expiry_date);
    if (expiry > now) {
      return {
        status: 'active' as const,
        daysRemaining: Math.ceil((expiry.getTime() - now.getTime()) / 86400000),
        expiryDate: business.license_expiry_date,
        isAccessible: true,
      };
    }
    return { status: 'expired' as const, daysRemaining: 0, isAccessible: false };
  }

  const daysElapsed = Math.floor((now.getTime() - trialStart.getTime()) / 86400000);
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed);

  if (daysRemaining > 0) {
    return {
      status: 'trial' as const,
      daysRemaining,
      expiryDate: trialEnd.toISOString(),
      isAccessible: true,
    };
  }
  return { status: 'expired' as const, daysRemaining: 0, isAccessible: false };
}

export function calcExpiryDate(duration: LicenseDuration): Date {
  const expiry = new Date();
  if (duration === '30days') expiry.setDate(expiry.getDate() + 30);
  else if (duration === '90days') expiry.setDate(expiry.getDate() + 90);
  else expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}