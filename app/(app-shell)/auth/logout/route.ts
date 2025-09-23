import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookiesOnResponse } from '@/lib/serverSupabase';

export async function GET(request: NextRequest) {
  const loginUrl = new URL('/login', request.nextUrl.origin);
  loginUrl.searchParams.set('logout', '1');

  const response = NextResponse.redirect(loginUrl);
  clearAuthCookiesOnResponse(response);

  return response;
}
