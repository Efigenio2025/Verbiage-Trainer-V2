import Link from 'next/link';
import { redirect } from 'next/navigation';
import PolarCard from '@/components/PolarCard';
import { getBrandName } from '@/lib/brand';
import { createServerSupabase } from '@/lib/serverSupabase';
import { sanitizeNextPath } from '@/lib/sanitizeNextPath';
import SignupForm from './SignupForm';

type SignupPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const nextParam = sanitizeNextPath(typeof searchParams?.next === 'string' ? searchParams.next : null);
    redirect(nextParam);
  }

  const brand = getBrandName();

  return (
    <main className="page">
      <PolarCard title={`Create your ${brand} ID`} subtitle={`Verify your email to access the ${brand} console`}>
        <SignupForm />
        <p className="helper-text">
          Already verified? <Link href="/login">Sign in</Link> to continue.
        </p>
      </PolarCard>
    </main>
  );
}
