'use server';

import { createServerSupabase } from '@/lib/serverSupabase';

type ResetPasswordState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  redirectTo?: string;
};

function sanitizeNext(path?: string): string {
  if (!path) return '/app';
  return path.startsWith('/') ? path : '/app';
}

export async function updatePasswordAction(_: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const nextPath = sanitizeNext(String(formData.get('next') ?? '/app'));

  if (!password || password.length < 8) {
    return { status: 'error', message: 'Password must be at least 8 characters long.' };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Reset link is invalid or has expired.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Password updated successfully. Redirecting to your dashboard…',
    redirectTo: nextPath
  };
}
