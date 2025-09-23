'use server';

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

type SignupState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
};

export async function signupAction(_: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: 'Email and password are required.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'error', message: 'Supabase configuration is missing.' };
  }

  const origin = headers().get('origin');
  const redirectTo = origin ? `${origin}/auth/callback?next=/app` : undefined;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo
    }
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Account created! Check your inbox to verify your email before signing in.'
  };
}
