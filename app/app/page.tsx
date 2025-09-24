import Link from 'next/link';
import PolarCard from '@/components/PolarCard';
import RoleBadge from '@/components/RoleBadge';
import { createServerSupabase } from '@/lib/serverSupabase';
import type { PostgrestError } from '@supabase/supabase-js';
import { getActiveTrainingModule, trainingLibrary, trainingMilestones } from '@/lib/trainingLibrary';

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

  const activeTraining = getActiveTrainingModule();
  const upcomingMilestones = trainingMilestones.map((milestone) => ({
    ...milestone,
    href: `/app/trainings/${milestone.moduleSlug}`
  }));

  return (
    <main className="page">
      <div className="dashboard">
        <PolarCard
          title="Polar Ops Command"
          subtitle={
            user?.email ? `Authenticated as ${user.email}` : 'Supabase session not detected'
          }
          className="dashboard-card dashboard-card--profile"
        >
          <div className="dashboard__meta">
            <div>
              <p className="muted">Welcome back</p>
              <h2 className="dashboard__headline">
                {profile?.email ?? user?.email ?? 'Trainee'}
              </h2>
              <p className="dashboard__subheadline">
                Review your status and jump into today&apos;s communication drills.
              </p>
            </div>
            <div className="dashboard__details">
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
              {activeTraining && (
                <div>
                  <span className="muted">Active module</span>
                  <p className="dashboard__detail-title">{activeTraining.title}</p>
                  <p className="muted">
                    {activeTraining.progress}% complete · {activeTraining.duration}
                  </p>
                </div>
              )}
            </div>
            {profileError && <p className="status-message error">{profileError}</p>}
            {profile?.updated_at && (
              <p className="muted">Last updated {new Date(profile.updated_at).toLocaleString()}</p>
            )}
            <div className="dashboard__quick">
              {activeTraining && (
                <Link href={`/app/trainings/${activeTraining.slug}`} className="btn btn-primary">
                  Resume training
                </Link>
              )}
              <Link href="#training-library" className="btn btn-outline">
                Browse trainings
              </Link>
            </div>
          </div>
        </PolarCard>

        <PolarCard
          id="training-library"
          title="Training library"
          subtitle="Choose a module to focus on today."
          className="dashboard-card"
        >
          <ul className="training-grid">
            {trainingLibrary.map((training) => (
              <li key={training.slug}>
                <Link href={`/app/trainings/${training.slug}`} className="training-card">
                  <div className="training-card__meta">
                    <span
                      className={`training-card__status training-card__status--${training.status
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {training.status}
                    </span>
                    <span className="training-card__duration">{training.duration}</span>
                  </div>
                  <h3 className="training-card__title">{training.title}</h3>
                  <p className="training-card__description">{training.summary}</p>
                  <div className="training-card__tags">
                    <span className="training-card__tag">{training.category}</span>
                    <span className="training-card__tag">{training.level}</span>
                  </div>
                  <div className="training-card__progress">
                    <div className="training-card__progress-bar">
                      <span
                        className="training-card__progress-fill"
                        style={{ width: `${training.progress}%` }}
                      />
                    </div>
                    <span className="training-card__progress-value">
                      {training.progress}% complete
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </PolarCard>

        <PolarCard
          title="Upcoming milestones"
          subtitle="Stay ahead of your assigned checkpoints."
          className="dashboard-card"
        >
          <ul className="dashboard-list">
            {upcomingMilestones.map((milestone) => {
              const training = trainingLibrary.find((item) => item.slug === milestone.moduleSlug);

              return (
                <li key={milestone.id}>
                  <Link href={milestone.href} className="dashboard-list__item">
                    <div>
                      <p className="dashboard-list__title">{milestone.title}</p>
                      <p className="dashboard-list__description">{milestone.description}</p>
                      {training && (
                        <span className="dashboard-list__badge">{training.title}</span>
                      )}
                    </div>
                    <span className="dashboard-list__due">{milestone.due}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </PolarCard>
      </div>
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
