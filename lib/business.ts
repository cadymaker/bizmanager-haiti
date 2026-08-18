import { createClient } from '@/lib/supabase/client';

export interface BusinessContext {
  businessId: string;
  role: 'owner' | 'cashier';
  userId: string;
}

/**
 * Jwenn vrè business_id ak wòl itilizatè ki konekte a.
 * - Pou yon mèt (owner): business_id = pwòp user.id li.
 * - Pou yon kesye (cashier): business_id = id biznis mèt la.
 * Retounen null si pa gen sesyon oswa pa gen manm.
 */
export async function getBusinessContext(): Promise<BusinessContext | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: membership, error } = await supabase
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', session.user.id)
    .single();

  if (error || !membership) return null;

  return {
    businessId: membership.business_id,
    role: membership.role as 'owner' | 'cashier',
    userId: session.user.id,
  };
}