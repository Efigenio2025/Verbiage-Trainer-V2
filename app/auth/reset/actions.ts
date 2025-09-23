'use server';

import { createServerSupabase } from '@/lib/serverSupabase';
import { sanitizeNextPath } from '@/lib/sanitizeNextPath';

type ResetPasswordState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  redirectTo?: string;
};

export async function updatePasswordAction(_: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const nextRaw = formData.get('next');
  const nextPath = sanitizeNextPath(typeof nextRaw === 'string' ? nextRaw : null);

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
