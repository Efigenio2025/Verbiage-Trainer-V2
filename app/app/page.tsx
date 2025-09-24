import Link from 'next/link';
import PolarCard from '@/components/PolarCard';
import RoleBadge from '@/components/RoleBadge';
import EmployeeTrainingLibrary from '@/components/EmployeeTrainingLibrary';
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
import { trainingLibrary } from '@/lib/trainingLibrary';

type SupportedRole = 'employee' | 'manager' | 'admin';

type EmployeeView = 'home' | 'library' | 'profile';

const employeeViews: EmployeeView[] = ['home', 'library', 'profile'];

function normalizeEmployeeView(view?: string): EmployeeView {
  if (!view) {
    return 'home';
  }

  return employeeViews.includes(view as EmployeeView) ? (view as EmployeeView) : 'home';
}

type DashboardCommonProps = {
  displayName: string;
  contactEmail: string;
  authEmail: string | null;
  updatedAt: Date | null;
  profileError: string | null;
};

const quickMetrics = [
  { label: 'Assigned', value: '3' },
  { label: 'Avg Acc', value: '96%' },
  { label: 'Streak', value: '5 days' }
];

const assignedTraining = [
  { title: 'De-ice Verbiage – Level 1', due: 'Due Fri', tone: 'default' as const },
  { title: 'Phonetic Alphabet – Accuracy', due: 'Due Today', tone: 'warn' as const },
  { title: 'Aircraft Movement – Tow & Push', due: 'Due Mon', tone: 'default' as const }
];

const recentScores = [
  { label: 'De-ice Callouts Drill', meta: '92% • 2d ago' },
  { label: 'Phonetic Alphabet Speed', meta: '88% • 5d ago' },
  { label: 'Pushback Script', meta: '95% • 1w ago' }
];

const coachingTips = [
  { icon: '▲', text: 'Your de-ice calls are trending upward—keep the cadence steady during shift change.' },
  { icon: '▼', text: 'Accuracy dipped on the alphabet sprint; slow the tempo for the next timed drill.' },
  { icon: '•', text: 'Maintain consistent towing phrasing so the tug team gets the same cues every time.' }
];

type CertificationTone = 'ok' | 'warn' | 'bad';

type EmployeeCertification = {
  name: string;
  status: string;
  tone: CertificationTone;
};

const employeeBadges = [
  'Cold-weather crew lead',
  'Ramp safety champion',
  'Phraseology coach',
  'Operations mentor'
];

const employeeCertifications: EmployeeCertification[] = [
  { name: 'De-ice Operations Level 1', status: 'Valid', tone: 'ok' },
  { name: 'Movement & Pushback Briefing', status: 'Expires soon', tone: 'warn' },
  { name: 'Radio Phraseology Audit', status: 'Expired', tone: 'bad' }
];

export default async function AppDashboard({
  searchParams
}: {
  searchParams?: { view?: string };
}) {
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

  const employeeView = normalizeEmployeeView(searchParams?.view);

  return (
    <main className="page">
      <div className={role === 'employee' ? 'employee-dashboard-shell' : 'dashboard'}>
        {role === 'admin' ? (
          <AdminDashboard {...commonProps} />
        ) : role === 'manager' ? (
          <ManagerDashboard {...commonProps} />
        ) : (
          <EmployeeDashboard {...commonProps} view={employeeView} />
        )}
      </div>
    </main>
  );
}

function EmployeeDashboard({
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAt,
  view
}: DashboardCommonProps & { view: EmployeeView }) {
  const navItems = [
    { label: 'Home', href: '/app', view: 'home' as const },
    { label: 'Library', href: '/app?view=library', view: 'library' as const },
    { label: 'Profile', href: '/app?view=profile', view: 'profile' as const }
  ];

  return (
    <>
      {view === 'home' && <EmployeeHome updatedAt={updatedAt} profileError={profileError} />}
      {view === 'library' && (
        <EmployeeTrainingLibrary modules={trainingLibrary} backHref="/app" />
      )}
      {view === 'profile' && (
        <EmployeeProfileView
          displayName={displayName}
          contactEmail={contactEmail}
          authEmail={authEmail}
          profileError={profileError}
          updatedAt={updatedAt}
        />
      )}

      <nav className="employee-dashboard__nav" aria-label="Employee navigation">
        {navItems.map((item) => {
          const isActive = item.view === view;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`employee-dashboard__nav-item${
                isActive ? ' employee-dashboard__nav-item--active' : ''
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="employee-dashboard__nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function EmployeeHome({
  profileError,
  updatedAt
}: {
  profileError: string | null;
  updatedAt: Date | null;
}) {
  return (
    <div className="employee-dashboard">
      <header className="employee-dashboard__header">
        <p className="employee-dashboard__eyebrow">Welcome back</p>
        <h1 className="employee-dashboard__title">Employee Dashboard</h1>
      </header>
      {updatedAt && (
        <p className="employee-dashboard__timestamp">Last updated {updatedAt.toLocaleString()}</p>
      )}
      {profileError && <p className="employee-dashboard__error">{profileError}</p>}

      <div className="employee-dashboard__metrics">
        {quickMetrics.map((metric) => (
          <div key={metric.label} className="employee-dashboard__metric">
            <span className="employee-dashboard__metric-label">{metric.label}</span>
            <span className="employee-dashboard__metric-value">{metric.value}</span>
          </div>
        ))}
      </div>

      <section className="employee-dashboard__card">
        <h2 className="employee-dashboard__card-title">Assigned Training</h2>
        <div className="employee-dashboard__rows">
          {assignedTraining.map((training) => (
            <div key={training.title} className="employee-dashboard__row">
              <span className="employee-dashboard__row-title">{training.title}</span>
              <span
                className={`employee-dashboard__tag${
                  training.tone === 'warn' ? ' employee-dashboard__tag--warn' : ''
                }`}
              >
                {training.due}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="employee-dashboard__card">
        <div className="employee-dashboard__card-header">
          <h2 className="employee-dashboard__card-title">Recent Scores</h2>
          <Link href="/app?view=library" className="employee-dashboard__action">
            See all
          </Link>
        </div>
        <div className="employee-dashboard__rows">
          {recentScores.map((score) => (
            <div key={score.label} className="employee-dashboard__row">
              <span className="employee-dashboard__row-title">{score.label}</span>
              <span className="employee-dashboard__row-meta">{score.meta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="employee-dashboard__card">
        <h2 className="employee-dashboard__card-title">Personal Coaching Tips</h2>
        <ul className="employee-dashboard__tips">
          {coachingTips.map((tip) => (
            <li key={tip.text} className="employee-dashboard__tip">
              <span className="employee-dashboard__tip-icon" aria-hidden="true">
                {tip.icon}
              </span>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmployeeProfileView({
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAt
}: {
  authEmail: string | null;
  contactEmail: string;
  displayName: string;
  profileError: string | null;
  updatedAt: Date | null;
}) {
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="employee-profile">
      <div className="employee-topbar">
        <Link href="/app" className="employee-topbar__back" aria-label="Back to Home">
          <svg
            className="employee-topbar__icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M15 5L8 12L15 19"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="employee-topbar__title">Profile</h1>
      </div>

      <div className="employee-profile__card employee-profile__identity">
        <div className="employee-profile__avatar" aria-hidden="true">
          <span>{initials}</span>
        </div>
        <div className="employee-profile__identity-text">
          <p className="employee-profile__name">{displayName}</p>
          <p className="employee-profile__subline">Ground Ops • Terminal C</p>
        </div>
        <span className="employee-profile__id">ID • EMP-4827</span>
      </div>

      <section>
        <h2 className="employee-profile__section-title">Badges</h2>
        <div className="employee-profile__badges">
          {employeeBadges.map((badge) => (
            <span key={badge} className="employee-profile__badge">
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="employee-profile__card employee-profile__certifications">
        <h2 className="employee-profile__section-title">Certifications</h2>
        <div className="employee-profile__cert-list">
          {employeeCertifications.map((cert) => (
            <div key={cert.name} className="employee-profile__cert-row">
              <span className="employee-profile__cert-name">{cert.name}</span>
              <span
                className={`employee-profile__status-tag employee-profile__status-tag--${cert.tone}`}
              >
                {cert.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <button type="button" className="employee-profile__signout">
        Sign out
      </button>

      <div className="employee-profile__meta">
        <p className="employee-profile__meta-line">Contact email: {contactEmail}</p>
        {authEmail && (
          <p className="employee-profile__meta-line">Signed in as {authEmail}</p>
        )}
        {updatedAt && (
          <p className="employee-profile__meta-line">
            Profile updated {updatedAt.toLocaleString()}
          </p>
        )}
        {profileError && <p className="employee-profile__meta-error">{profileError}</p>}
      </div>
    </div>
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
