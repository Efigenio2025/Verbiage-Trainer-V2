'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction } from './actions';

const initialState = { status: 'idle' as const, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-outline" disabled={pending}>
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  );
}

export default function PasswordResetForm() {
  const [state, formAction] = useFormState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="form-grid">
      <label>
        Forgot password?
        <input type="email" name="email" placeholder="Enter your email" required autoComplete="email" />
      </label>
      {state.status !== 'idle' && (
        <p className={`status-message ${state.status === 'error' ? 'error' : 'success'}`}>{state.message}</p>
      )}
      <SubmitButton />
      <p className="helper-text">We&apos;ll email you a secure link to reset your password.</p>
    </form>
  );
}
