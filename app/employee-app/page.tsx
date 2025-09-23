import { redirect } from 'next/navigation';
import EmployeeAppClient from './EmployeeAppClient';
import { createServerSupabase } from '@/lib/serverSupabase';
import { mapProfileError } from '@/lib/profile';

export default async function EmployeeAppPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/employee-app');
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, updated_at')
    .eq('id', user.id)
    .single();

  return (
    <EmployeeAppClient
      userEmail={user.email ?? null}
      userRole={profileData?.role ?? null}
      profileUpdatedAt={profileData?.updated_at ?? null}
      profileError={mapProfileError(profileError)}
    />
  );
}
