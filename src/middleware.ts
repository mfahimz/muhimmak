import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect dashboard routes
  const isDashboardRoute = pathname.startsWith('/dashboard') || 
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

  // Fetch the current user session
  const { data: { session } } = await supabase.auth.getSession();

  // MOCK LOGIC: In production, uncomment the redirection logic below.
  // For the scaffolding/preview phase, we allow access to easily demo pages.
  /*
  if (isDashboardRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && session) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  */

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
