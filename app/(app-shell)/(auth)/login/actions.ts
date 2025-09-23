'use server';

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { setAuthCookies } from '@/lib/serverSupabase';
import { sanitizeNextPath } from '@/lib/sanitizeNextPath';

type LoginState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  redirectTo?: string;
};

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextRaw = formData.get('next');
  const nextPath = sanitizeNextPath(typeof nextRaw === 'string' ? nextRaw : null);

  if (!email || !password) {
    return { status: 'error', message: 'Email and password are required.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'error', message: 'Supabase configuration is missing.' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return { status: 'error', message: error?.message ?? 'Unable to sign in.' };
  }

  await setAuthCookies(data.session);

  return { status: 'success', message: 'Welcome back!', redirectTo: nextPath };
}

type ResetState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
};

export async function resetPasswordAction(_: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return { status: 'error', message: 'Enter your account email first.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'error', message: 'Supabase configuration is missing.' };
  }

  const origin = headers().get('origin');
  const redirectTo = origin ? `${origin}/auth/callback?next=/auth/reset` : undefined;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'success', message: 'Password reset email sent. Check your inbox.' };
}
