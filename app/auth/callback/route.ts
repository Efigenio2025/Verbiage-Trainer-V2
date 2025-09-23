import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearAuthCookiesOnResponse, setAuthCookiesOnResponse } from '@/lib/serverSupabase';
import { sanitizeNextPath } from '@/lib/sanitizeNextPath';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextPath = sanitizeNextPath(searchParams.get('next'));

  const loginRedirect = new URL('/login', origin);
  if (!code) {
    loginRedirect.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(loginRedirect);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    loginRedirect.searchParams.set('error', 'configuration_error');
    return NextResponse.redirect(loginRedirect);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    loginRedirect.searchParams.set('error', error?.message ?? 'auth_error');
    const errorResponse = NextResponse.redirect(loginRedirect);
    clearAuthCookiesOnResponse(errorResponse);
    return errorResponse;
  }

  const destination = new URL(nextPath, origin);
  const response = NextResponse.redirect(destination);
  setAuthCookiesOnResponse(response, data.session);
  return response;
}
