'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signupAction } from './actions';

const initialState = { status: 'idle' as const, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  );
}

export default function SignupForm() {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <form action={formAction} className="form-grid">
      <label>
        Work email
        <input type="email" name="email" placeholder="you@company.com" required autoComplete="email" />
      </label>
      <label>
        Password
        <input type="password" name="password" placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" />
      </label>
      {state.status !== 'idle' && (
        <p className={`status-message ${state.status === 'error' ? 'error' : 'success'}`}>{state.message}</p>
      )}
      <SubmitButton />
    </form>
  );
}
