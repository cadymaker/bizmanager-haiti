import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = [
  '/dashboard', '/pos', '/inventory', '/invoices', '/clients',
  '/expenses', '/reports', '/promotions', '/cash-history', '/team',
]

const ALWAYS_ALLOWED = [
  '/subscribe', '/settings', '/expired', '/admin', '/login', '/register',
  '/legal', '/choose-currency', '/forgot-password', '/reset-password',
]

// Paj egzante de tchèk 2FA a (paj otantifikasyon + paj verifikasyon an)
const TWO_FA_EXEMPT = [
  '/login', '/register', '/forgot-password', '/reset-password',
  '/verify-2fa', '/legal', '/choose-currency',
]

function isLicenseActive(biz: any): boolean {
  if (!biz) return false
  if (biz.is_admin) return true
  const now = Date.now()
  if (biz.license_status === 'active' && biz.license_expiry_date) {
    return new Date(biz.license_expiry_date).getTime() > now
  }
  if (biz.license_status === 'trial' && biz.trial_start_date) {
    const end = new Date(biz.trial_start_date)
    end.setDate(end.getDate() + 14)
    return end.getTime() > now
  }
  return false
}

// Dekode session_id nan JWT a (runtime edge → atob, pa Buffer)
function decodeSessionId(accessToken: string | undefined): string | null {
  if (!accessToken) return null
  try {
    const part = accessToken.split('.')[1]
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return payload.session_id ?? null
  } catch { return null }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api')

  // Pa gen itilizatè, oswa API → kite pase
  if (!user || isApi) {
    return response
  }

  // Kliyan admin (service role) pou kontoune RLS — middleware la se sèvè
  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )

  const { data: link } = await admin
    .from('business_users')
    .select('business_id, role, two_factor_email')
    .eq('user_id', user.id)
    .maybeSingle()

  const businessId = link?.business_id ?? user.id
  const role = link?.role ?? 'owner'

  // ===== Enfòsman 2FA (anvan lisans lan) =====
  const isTwoFAExempt = TWO_FA_EXEMPT.some(p => path.startsWith(p))
  if (link?.two_factor_email && !isTwoFAExempt) {
    const { data: { session } } = await supabase.auth.getSession()
    const sessionId = decodeSessionId(session?.access_token)
    let verified = false
    if (sessionId) {
      const { data: v } = await admin
        .from('verified_2fa_sessions')
        .select('session_id')
        .eq('session_id', sessionId)
        .maybeSingle()
      verified = !!v
    }
    if (!verified) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-2fa'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // ===== Tchèk lisans (sèlman paj pwoteje yo) =====
  const isProtected = PROTECTED.some(p => path.startsWith(p))
  const isAlwaysAllowed = ALWAYS_ALLOWED.some(p => path.startsWith(p))
  if (!isProtected || isAlwaysAllowed) {
    return response
  }

  const { data: biz } = await admin
    .from('businesses')
    .select('is_admin, license_status, license_expiry_date, trial_start_date')
    .eq('id', businessId)
    .maybeSingle()

  if (isLicenseActive(biz)) {
    return response
  }

  const url = request.nextUrl.clone()
  url.pathname = role === 'cashier' ? '/expired' : '/subscribe'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}