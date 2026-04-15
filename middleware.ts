import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

const publicPaths = ['/login', '/api/auth/login', '/api/auth/me', '/manifest.json', '/favicon.ico']

export async function middleware(req: NextRequest) {
  const rawPath = req.nextUrl.pathname
  const path = rawPath.endsWith('/') && rawPath !== '/' ? rawPath.slice(0, -1) : rawPath;
  
  const isOrderPage = path === "/order" || path.startsWith("/order/");
  const isPublicApi = path === "/api/public" || path.startsWith("/api/public/");
  const isPublic = isOrderPage || isPublicApi || publicPaths.some(p => path === p || path.startsWith('/_next/'))

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (!isPublic && !session) {
    if (path.startsWith('/api/')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (path === '/login' && session) {
    if (session.role.includes('SUPER_ADMIN')) {
        return NextResponse.redirect(new URL('/super-admin', req.nextUrl))
    }
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  const requestHeaders = new Headers(req.headers)
  if (session) {
      requestHeaders.set('x-user-id', session.id)
      requestHeaders.set('x-user-role', session.role)
      if (session.permissions) {
          requestHeaders.set('x-user-permissions', JSON.stringify(session.permissions))
      }
      if (session.role.includes('SUPER_ADMIN')) {
          const clientRequestedBranch = req.headers.get('x-requested-branch');
          if (clientRequestedBranch === 'GLOBAL') {
              // Intentionally bypass scoping for global admin view
          } else {
              // Use requested branch, fallback to cookie, then fallback to session's default branch
              const activeBranch = clientRequestedBranch || req.cookies.get('active_branch_id')?.value || session.branchId;
              if (activeBranch) {
                  requestHeaders.set('x-user-branch', activeBranch)
              }
          }
      } else if (session.branchId) {
          requestHeaders.set('x-user-branch', session.branchId)
      }
  }

  return NextResponse.next({
      request: {
          headers: requestHeaders,
      }
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
