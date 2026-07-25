import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { writeAuditLog } from '@/lib/audit/log';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isDashboardRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/forms') ||
    pathname.startsWith('/templates') ||
    pathname.startsWith('/settings');

  const isAuthRoute = pathname.startsWith('/login');

  // Create a response so we can set cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  // We initialize the Supabase client in the middleware to refresh session tokens
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({
            request,
          });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: use getUser(), not getSession() — getSession() reads the
  // (possibly stale/forged) cookie without revalidating against Supabase.
  // getUser() round-trips to Supabase Auth and is the only safe way to
  // check auth state in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const sessionStartCookie = request.cookies.get('muhimmak_session_start');
    const sessionTimeoutMinutes = Number(process.env.SESSION_TIMEOUT_MINUTES ?? 720);
    const sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
    
    let isExpired = false;
    let elapsedTimeMs = 0;

    if (!sessionStartCookie) {
      isExpired = true;
    } else {
      const startTime = new Date(sessionStartCookie.value).getTime();
      const now = Date.now();
      elapsedTimeMs = now - startTime;
      if (isNaN(startTime) || elapsedTimeMs > sessionTimeoutMs) {
        isExpired = true;
      }
    }

    if (isExpired) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
      await Promise.all([
        supabase.auth.signOut(),
        writeAuditLog({
          actorId: user.id,
          action: 'session_expired',
          ipAddress: ip,
          metadata: {
            elapsedTimeMs,
            sessionTimeoutMinutes,
            reason: !sessionStartCookie ? 'missing_cookie' : 'timeout',
          },
        }),
      ]);

      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'session_expired');
      const redirectResponse = NextResponse.redirect(url);

      redirectResponse.cookies.delete('muhimmak_session_start');
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith('sb-') || cookie.name === 'muhimmak_session_start') {
          redirectResponse.cookies.delete(cookie.name);
        }
      });

      return redirectResponse;
    }
  }

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

// Ensure the middleware runs only on specified paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/forms/:path*',
    '/templates/:path*',
    '/settings/:path*',
    '/login',
  ],
};
