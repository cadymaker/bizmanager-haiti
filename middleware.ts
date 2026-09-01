import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paj ki mande yon lisans valab
const PROTECTED = [
  '/dashboard',
  '/pos',
  '/inventory',
  '/invoices',
  '/clients',
  '/expenses',
  '/reports',
  '/promotions',
  '/cash-history',
  '/team',
]

// Paj ki toujou pèmèt (menm si lisans ekspire)
const ALWAYS_ALLOWED = [
  '/subscribe',
  '/settings',
  '/expired',
  '/admin',
  '/login',
  '/register',
  '/legal',
  '/choose-currency',
  '/forgot-password',
  '/reset-password',
]

// Èske lisans lan valab?
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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Sote verifikasyon an sou paj piblik yo ak API yo
  const isAlwaysAllowed = ALWAYS_ALLOWED.some(p => path.startsWith(p))
  const isProtected = PROTECTED.some(p => path.startsWith(p))

  if (!user || isAlwaysAllowed || !isProtected) {
    return response
  }

    // ===== Verifye lisans lan =====
  // Nou sèvi ak kle sèvis la pou kontoune RLS — middleware la se sèvè,
  // epi nou deja verifye idantite moun nan ak getUser().
  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() { /* pa gen cookie pou kle sèvis la */ },
      },
    }
  )

  const { data: link } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const businessId = link?.business_id ?? user.id
  const role = link?.role ?? 'owner'

  const { data: biz } = await admin
    .from('businesses')
    .select('is_admin, license_status, license_expiry_date, trial_start_date')
    .eq('id', businessId)
    .maybeSingle()

  if (isLicenseActive(biz)) {
    return response
  }

  // Lisans ekspire — kote pou voye moun nan
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