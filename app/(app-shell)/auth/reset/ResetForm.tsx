'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updatePasswordAction } from './actions';
import { getDefaultNextPath } from '@/lib/sanitizeNextPath';

const initialState = { status: 'idle' as const, message: '', redirectTo: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}

export default function ResetForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [state, formAction] = useFormState(updatePasswordAction, initialState);

  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      const timer = setTimeout(() => {
        router.replace(state.redirectTo!);
        router.refresh();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="form-grid">
      <input type="hidden" name="next" value={nextPath ?? getDefaultNextPath()} />
      <label>
        New password
        <input type="password" name="password" placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" />
      </label>
      {state.status !== 'idle' && (
        <p className={`status-message ${state.status === 'error' ? 'error' : 'success'}`}>{state.message}</p>
      )}
      <SubmitButton />
    </form>
  );
}
