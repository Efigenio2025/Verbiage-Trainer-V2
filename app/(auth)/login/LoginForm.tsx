'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { loginAction } from './actions';
import { getDefaultNextPath } from '@/lib/sanitizeNextPath';

const initialState = { status: 'idle' as const, message: '', redirectTo: '' };

type LoginFormProps = {
  nextPath?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(loginAction, initialState);

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="form-grid">
      <input type="hidden" name="next" value={nextPath ?? getDefaultNextPath()} />
      <label>
        Email
        <input type="email" name="email" placeholder="you@example.com" required autoComplete="email" />
      </label>
      <label>
        Password
        <input type="password" name="password" placeholder="••••••••" required autoComplete="current-password" />
      </label>
      {state.status === 'error' && <p className="status-message error">{state.message}</p>}
      <SubmitButton />
    </form>
  );
}
