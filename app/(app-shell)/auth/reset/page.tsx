import { redirect } from 'next/navigation';
import PolarCard from '@/components/PolarCard';
import { createServerSupabase } from '@/lib/serverSupabase';
import { getDefaultNextPath } from '@/lib/sanitizeNextPath';
import ResetForm from './ResetForm';

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="page">
      <PolarCard title="Set a new password" subtitle={`Resetting for ${user.email}`}>
        <ResetForm nextPath={getDefaultNextPath()} />
      </PolarCard>
    </main>
  );
}
