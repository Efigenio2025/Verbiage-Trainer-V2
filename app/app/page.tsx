import PolarCard from '@/components/PolarCard';
import RoleBadge from '@/components/RoleBadge';
import { createServerSupabase } from '@/lib/serverSupabase';
import type { PostgrestError } from '@supabase/supabase-js';

export default async function AppDashboard() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { email: string; role: string; updated_at: string | null } | null = null;
  let profileError: string | null = null;

  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email, role, updated_at')
      .eq('id', user.id)
      .single();

    profile = data ?? null;
    profileError = mapProfileError(error);
  }

  return (
    <main className="page">
      <PolarCard
        title="Polar Ops Command"
        subtitle={user?.email ? `Authenticated as ${user.email}` : 'Supabase session not detected'}
        className="dashboard"
      >
        <div className="dashboard__meta">
          <div>
            <span className="muted">Role</span>
            <div>
              <RoleBadge role={profile?.role ?? 'employee'} />
            </div>
          </div>
          <div>
            <span className="muted">Email</span>
            <p>{profile?.email ?? user?.email ?? 'Unknown'}</p>
          </div>
          {profileError && <p className="status-message error">{profileError}</p>}
          {profile?.updated_at && (
            <p className="muted">Last updated {new Date(profile.updated_at).toLocaleString()}</p>
          )}
        </div>
      </PolarCard>
    </main>
  );
}

function mapProfileError(error: PostgrestError | null): string | null {
  if (!error) return null;

  const missingTableCodes = new Set(['PGRST301', 'PGRST302', '42P01']);
  const normalizedMessage = error.message.toLowerCase();

  if (missingTableCodes.has(error.code ?? '') || normalizedMessage.includes('schema cache')) {
    return 'Profiles table missing. Run the SQL in sql/init.sql against your Supabase project to provision it.';
  }

  return 'Unable to load profile details right now.';
}
