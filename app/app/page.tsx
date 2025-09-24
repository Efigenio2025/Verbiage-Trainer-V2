import Link from 'next/link';
import PolarCard from '@/components/PolarCard';
import RoleBadge from '@/components/RoleBadge';
import { createServerSupabase } from '@/lib/serverSupabase';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  adminComplianceTasks,
  adminOperationsMetrics,
  adminProvisioningQueue,
  adminSystemHealth,
  managerCoachingMoments,
  managerOperationalSignals,
  managerSnapshotMetrics,
  managerTeamReadiness
} from '@/lib/roleDashboards';
import { getActiveTrainingModule, trainingLibrary, trainingMilestones } from '@/lib/trainingLibrary';

type SupportedRole = 'employee' | 'manager' | 'admin';

type DashboardCommonProps = {
  displayName: string;
  contactEmail: string;
  authEmail: string | null;
  updatedAt: Date | null;
  profileError: string | null;
};

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

  const role = normalizeRole(profile?.role);
  const displayName = profile?.email ?? user?.email ?? 'Trainee';
  const contactEmail = profile?.email ?? user?.email ?? 'Unknown';
  const updatedAt = profile?.updated_at ? new Date(profile.updated_at) : null;
  const authEmail = user?.email ?? null;

  const commonProps: DashboardCommonProps = {
    displayName,
    contactEmail,
    authEmail,
    updatedAt,
    profileError
  };

  const activeTraining = role === 'employee' ? getActiveTrainingModule() : undefined;

  return (
    <main className="page">
      <div className="dashboard">
        {role === 'admin' ? (
          <AdminDashboard {...commonProps} />
        ) : role === 'manager' ? (
          <ManagerDashboard {...commonProps} />
        ) : (
          <EmployeeDashboard {...commonProps} activeTraining={activeTraining} />
        )}
      </div>
    </main>
  );
}

type EmployeeDashboardProps = DashboardCommonProps & {
  activeTraining: ReturnType<typeof getActiveTrainingModule>;
};

function EmployeeDashboard({
  activeTraining,
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAt
}: EmployeeDashboardProps) {
  const upcomingMilestones = trainingMilestones.map((milestone) => ({
    ...milestone,
    href: `/app/trainings/${milestone.moduleSlug}`
  }));

  return (
    <>
      <PolarCard
        title="Polar Ops Command"
        subtitle={authEmail ? `Authenticated as ${authEmail}` : 'Supabase session not detected'}
        className="dashboard-card dashboard-card--profile"
      >
        <div className="dashboard__meta">
          <div>
            <p className="muted">Welcome back</p>
            <h2 className="dashboard__headline">{displayName}</h2>
            <p className="dashboard__subheadline">
              Review your status and jump into today&apos;s communication drills.
            </p>
          </div>
          <div className="dashboard__details">
            <div>
              <span className="muted">Role</span>
              <div>
                <RoleBadge role="employee" />
              </div>
            </div>
            <div>
              <span className="muted">Email</span>
              <p>{contactEmail}</p>
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
          {updatedAt && (
            <p className="muted">Last updated {updatedAt.toLocaleString()}</p>
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
                  <span className="training-card__progress-value">{training.progress}% complete</span>
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
                    {training && <span className="dashboard-list__badge">{training.title}</span>}
                  </div>
                  <span className="dashboard-list__due">{milestone.due}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PolarCard>
    </>
  );
}

function ManagerDashboard({
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAt
}: DashboardCommonProps) {
  const activeAlerts = managerOperationalSignals.filter((signal) => signal.tone === 'alert').length;

  return (
    <>
      <PolarCard
        title="Team coordination hub"
        subtitle={authEmail ? `Authenticated as ${authEmail}` : 'Supabase session not detected'}
        className="dashboard-card dashboard-card--profile"
      >
        <div className="dashboard__meta">
          <div>
            <p className="muted">Operational leadership</p>
            <h2 className="dashboard__headline">{displayName}</h2>
            <p className="dashboard__subheadline">
              Align your crew and clear blockers before the next departure bank.
            </p>
          </div>
          <div className="dashboard__details">
            <div>
              <span className="muted">Role</span>
              <div>
                <RoleBadge role="manager" />
              </div>
            </div>
            <div>
              <span className="muted">Email</span>
              <p>{contactEmail}</p>
            </div>
            <div>
              <span className="muted">Today&apos;s focus</span>
              <p className="dashboard__detail-title">Storm-readiness checks</p>
              <p className="muted">Confirm coverage and de-ice rehearsal plan.</p>
            </div>
            <div>
              <span className="muted">Active alerts</span>
              <p className="dashboard__detail-title">{activeAlerts}</p>
              <p className="muted">See operational signals below.</p>
            </div>
          </div>
          {profileError && <p className="status-message error">{profileError}</p>}
          {updatedAt && (
            <p className="muted">Last updated {updatedAt.toLocaleString()}</p>
          )}
          <div className="dashboard__quick">
            <Link href="#team-progress" className="btn btn-primary">
              Review team progress
            </Link>
            <Link href="/app/trainings/de-ice-procedures" className="btn btn-outline">
              Assign refresher
            </Link>
            <Link href="#manager-signals" className="btn btn-subtle">
              View signals
            </Link>
          </div>
          <div className="metric-grid metric-grid--compact">
            {managerSnapshotMetrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <p className="metric-card__label">{metric.label}</p>
                <p className="metric-card__value">{metric.value}</p>
                <p className="metric-card__helper">{metric.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </PolarCard>

      <PolarCard
        id="team-progress"
        title="Team training progress"
        subtitle="Spot who needs coaching before the next shift."
        className="dashboard-card"
      >
        <ul className="training-grid">
          {managerTeamReadiness.map((member) => (
            <li key={member.name}>
              <div className="training-card">
                <div className="training-card__meta">
                  <span className={`status-pill status-pill--${member.tone}`}>{member.status}</span>
                  <span className="training-card__duration">{member.nextCheckpoint}</span>
                </div>
                <h3 className="training-card__title">{member.name}</h3>
                <p className="training-card__description">Coaching focus: {member.focusModule}</p>
                <div className="training-card__tags">
                  <span className="training-card__tag">{member.role}</span>
                  <span className="training-card__tag">{member.coverage}</span>
                </div>
                <div className="training-card__progress">
                  <div className="training-card__progress-bar">
                    <span
                      className="training-card__progress-fill"
                      style={{ width: `${member.progress}%` }}
                    />
                  </div>
                  <span className="training-card__progress-value">{member.progress}% complete</span>
                </div>
                <p className="training-card__description">{member.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </PolarCard>

      <PolarCard
        title="Upcoming coaching moments"
        subtitle="Document what you promise and follow up with your leads."
        className="dashboard-card"
      >
        <ul className="dashboard-list">
          {managerCoachingMoments.map((moment) => (
            <li key={moment.id}>
              <Link
                href={`/app/trainings/${moment.moduleSlug}`}
                className="dashboard-list__item"
              >
                <div>
                  <p className="dashboard-list__title">{moment.title}</p>
                  <p className="dashboard-list__description">{moment.description}</p>
                  <span className="dashboard-list__badge">{moment.person}</span>
                </div>
                <span className="dashboard-list__due">{moment.due}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PolarCard>

      <PolarCard
        id="manager-signals"
        title="Operational signals"
        subtitle="Watch the field and intervene before issues escalate."
        className="dashboard-card"
      >
        <div className="status-grid">
          {managerOperationalSignals.map((signal) => (
            <div
              key={signal.id}
              className={`status-card status-card--${signal.tone}`}
            >
              <div>
                <p className="status-card__title">{signal.title}</p>
                <p className="status-card__detail">{signal.detail}</p>
              </div>
              <span className={`status-pill status-pill--${signal.tone}`}>{signal.status}</span>
            </div>
          ))}
        </div>
      </PolarCard>
    </>
  );
}

function AdminDashboard({
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAt
}: DashboardCommonProps) {
  const openReviews = adminComplianceTasks.length;
  const pendingApprovals = adminProvisioningQueue.filter((request) => request.tone !== 'success').length;

  return (
    <>
      <PolarCard
        title="Operations control center"
        subtitle={authEmail ? `Authenticated as ${authEmail}` : 'Supabase session not detected'}
        className="dashboard-card dashboard-card--profile"
      >
        <div className="dashboard__meta">
          <div>
            <p className="muted">System oversight</p>
            <h2 className="dashboard__headline">{displayName}</h2>
            <p className="dashboard__subheadline">
              Monitor access, compliance, and platform health for the entire organization.
            </p>
          </div>
          <div className="dashboard__details">
            <div>
              <span className="muted">Role</span>
              <div>
                <RoleBadge role="admin" />
              </div>
            </div>
            <div>
              <span className="muted">Email</span>
              <p>{contactEmail}</p>
            </div>
            <div>
              <span className="muted">Reviews due</span>
              <p className="dashboard__detail-title">{openReviews}</p>
              <p className="muted">Compliance tasks waiting for audit log.</p>
            </div>
            <div>
              <span className="muted">Access approvals</span>
              <p className="dashboard__detail-title">{pendingApprovals}</p>
              <p className="muted">Provisioning requests needing review.</p>
            </div>
          </div>
          {profileError && <p className="status-message error">{profileError}</p>}
          {updatedAt && (
            <p className="muted">Last updated {updatedAt.toLocaleString()}</p>
          )}
          <div className="dashboard__quick">
            <Link href="#system-health" className="btn btn-primary">
              Check system health
            </Link>
            <Link href="#provisioning-queue" className="btn btn-outline">
              Triage access queue
            </Link>
            <Link href="#compliance" className="btn btn-subtle">
              Review compliance
            </Link>
          </div>
          <div className="metric-grid metric-grid--compact">
            {adminOperationsMetrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <p className="metric-card__label">{metric.label}</p>
                <p className="metric-card__value">{metric.value}</p>
                <p className="metric-card__helper">{metric.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </PolarCard>

      <PolarCard
        id="system-health"
        title="Platform health"
        subtitle="Keep uptime steady and surface issues to engineering."
        className="dashboard-card"
      >
        <div className="status-grid">
          {adminSystemHealth.map((signal) => (
            <div key={signal.id} className={`status-card status-card--${signal.tone}`}>
              <div>
                <p className="status-card__title">{signal.title}</p>
                <p className="status-card__detail">{signal.detail}</p>
              </div>
              <span className={`status-pill status-pill--${signal.tone}`}>{signal.status}</span>
            </div>
          ))}
        </div>
      </PolarCard>

      <PolarCard
        id="provisioning-queue"
        title="Provisioning queue"
        subtitle="Approve, provision, or follow up on pending access requests."
        className="dashboard-card"
      >
        <div className="queue">
          <div className="queue__row queue__row--header">
            <span>Requester</span>
            <span>Role</span>
            <span>Status</span>
          </div>
          {adminProvisioningQueue.map((request) => (
            <div key={request.id} className="queue__row">
              <div className="queue__cell">
                <p className="queue__primary">{request.requester}</p>
                <span className="muted">{request.submitted}</span>
              </div>
              <div className="queue__cell queue__cell--center">{request.role}</div>
              <div className="queue__cell queue__cell--status">
                <span className={`status-pill status-pill--${request.tone}`}>{request.status}</span>
              </div>
            </div>
          ))}
        </div>
      </PolarCard>

      <PolarCard
        id="compliance"
        title="Compliance & audits"
        subtitle="Document evidence and keep regulators satisfied."
        className="dashboard-card"
      >
        <ul className="dashboard-list">
          {adminComplianceTasks.map((task) => (
            <li key={task.id}>
              <div className="dashboard-list__item dashboard-list__item--static">
                <div>
                  <p className="dashboard-list__title">{task.title}</p>
                  <p className="dashboard-list__description">{task.description}</p>
                </div>
                <span className="dashboard-list__due">{task.due}</span>
              </div>
            </li>
          ))}
        </ul>
      </PolarCard>
    </>
  );
}

function normalizeRole(role: string | null | undefined): SupportedRole {
  const normalized = role?.toLowerCase();

  if (normalized === 'admin' || normalized === 'manager') {
    return normalized;
  }

  return 'employee';
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