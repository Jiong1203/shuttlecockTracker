import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run on static assets or API routes (optional, depending on your needs)
  if (request.nextUrl.pathname.startsWith('/api')) {
    return supabaseResponse
  }

  // Refreshing the auth token
  const { data: { user } } = await supabase.auth.getUser()

  // 採「預設保護、明確開放」：列舉公開路徑，其餘一律要求登入。
  // 先前是反過來列舉受保護路徑，結果 /settings 沒被列進去，只靠頁面自己的
  // getSession() 把關——而 getSession 在伺服器端只解 cookie、不驗證簽章。
  // 改成這個方向後，日後新增頁面預設就是安全的。
  const PUBLIC_PATHS = ['/login', '/manual']
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
