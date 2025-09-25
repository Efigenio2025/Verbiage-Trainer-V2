import Link from 'next/link';
import { redirect } from 'next/navigation';
import PolarCard from '@/components/PolarCard';
import { getBrandName } from '@/lib/brand';
import { createServerSupabase } from '@/lib/serverSupabase';
import { getDefaultNextPath, sanitizeNextPath } from '@/lib/sanitizeNextPath';
import LoginForm from './LoginForm';
import PasswordResetForm from './PasswordResetForm';

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const errorMessages: Record<string, string> = {
  missing_code: 'The verification link is missing a token. Please request a new email.',
  configuration_error: 'Server configuration is incomplete. Contact an administrator.',
  auth_error: 'Authentication failed. Please try again.'
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextParam = sanitizeNextPath(typeof searchParams?.next === 'string' ? searchParams.next : null);
  let statusMessage: string | null = null;
  let statusVariant: 'success' | 'error' = 'success';

  if (searchParams?.logout === '1') {
    statusMessage = 'You have been signed out.';
  }

  if (typeof searchParams?.error === 'string') {
    statusVariant = 'error';
    statusMessage = errorMessages[searchParams.error] ?? searchParams.error;
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect(nextParam || getDefaultNextPath());
  }

  const brand = getBrandName();

  return (
    <main className="page">
      <PolarCard title="Welcome back" subtitle={`Access the ${brand} console`}>
        {statusMessage && <p className={`status-message ${statusVariant}`}>{statusMessage}</p>}
        <LoginForm nextPath={nextParam} />
        <PasswordResetForm />
        <p className="helper-text">
          No account yet? <Link href="/signup">Create one</Link>.
        </p>
      </PolarCard>
    </main>
  );
}