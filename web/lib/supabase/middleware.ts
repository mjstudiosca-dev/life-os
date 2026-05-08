// Middleware-compatible Supabase client — refreshes the user's session on
// every request so server-rendered pages always see fresh auth state.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Calling getUser refreshes the session if needed.
  const { data: { user } } = await supabase.auth.getUser();

  // Gate routes: send unauthenticated users to /login except for the login
  // and auth-callback paths.
  const url = request.nextUrl;
  const isPublic =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/cron"); // cron uses its own auth header

  if (!user && !isPublic) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
