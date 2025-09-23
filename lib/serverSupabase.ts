import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are not set.');
}

const secureCookie = process.env.NODE_ENV === 'production';
const baseCookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: 'lax' as const,
  path: '/'
};

export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  const refreshToken = cookieStore.get('sb-refresh-token')?.value;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  return supabase;
}

export function createServiceRoleSupabase(): SupabaseClient {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for server operations.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

export async function setAuthCookies(session: Session): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set('sb-access-token', session.access_token, {
    ...baseCookieOptions,
    maxAge: session.expires_in ?? 60 * 60
  });
  cookieStore.set('sb-refresh-token', session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30
  });
}

export function setAuthCookiesOnResponse(response: NextResponse, session: Session): void {
  response.cookies.set('sb-access-token', session.access_token, {
    ...baseCookieOptions,
    maxAge: session.expires_in ?? 60 * 60
  });
  response.cookies.set('sb-refresh-token', session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearAuthCookies(): void {
  const cookieStore = cookies();
  cookieStore.set('sb-access-token', '', {
    ...baseCookieOptions,
    maxAge: 0
  });
  cookieStore.set('sb-refresh-token', '', {
    ...baseCookieOptions,
    maxAge: 0
  });
}

export function clearAuthCookiesOnResponse(response: NextResponse): void {
  response.cookies.set('sb-access-token', '', {
    ...baseCookieOptions,
    maxAge: 0
  });
  response.cookies.set('sb-refresh-token', '', {
    ...baseCookieOptions,
    maxAge: 0
  });
}
