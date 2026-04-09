import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

const publicPaths = ['/login', '/api/auth/login', '/api/auth/me', '/manifest.json', '/favicon.ico']

export async function proxy(req: NextRequest) {
  const rawPath = req.nextUrl.pathname
  const path = rawPath.endsWith('/') && rawPath !== '/' ? rawPath.slice(0, -1) : rawPath;
  
  const isPublic = publicPaths.some(p => path === p || path.startsWith('/_next/'))

  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (!isPublic && !session) {
    if (path.startsWith('/api/')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (path === '/login' && session) {
    if (session.role === 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/super-admin', req.nextUrl))
    }
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  const requestHeaders = new Headers(req.headers)
  if (session) {
      requestHeaders.set('x-user-id', session.id)
      requestHeaders.set('x-user-role', session.role)
      if (session.branchId) {
          requestHeaders.set('x-user-branch', session.branchId)
      } else if (session.role === 'SUPER_ADMIN') {
          const activeBranch = req.cookies.get('active_branch_id')?.value;
          if (activeBranch) {
              requestHeaders.set('x-user-branch', activeBranch)
          }
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
