'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import EmployeeTrainingLibrary from '@/components/EmployeeTrainingLibrary';
import type { TrainingModule } from '@/lib/trainingLibrary';
import type { EmployeeView } from '@/lib/employeeViews';
import { normalizeEmployeeView } from '@/lib/employeeViews';

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
  {
    icon: '▲',
    text: 'Your de-ice calls are trending upward—keep the cadence steady during shift change.'
  },
  {
    icon: '▼',
    text: 'Accuracy dipped on the alphabet sprint; slow the tempo for the next timed drill.'
  },
  {
    icon: '•',
    text: 'Maintain consistent towing phrasing so the tug team gets the same cues every time.'
  }
];

const employeeBadges = [
  'Cold-weather crew lead',
  'Ramp safety champion',
  'Phraseology coach',
  'Operations mentor'
];

const employeeCertifications = [
  { name: 'De-ice Operations Level 1', status: 'Valid', tone: 'ok' as const },
  { name: 'Movement & Pushback Briefing', status: 'Expires soon', tone: 'warn' as const },
  { name: 'Radio Phraseology Audit', status: 'Expired', tone: 'bad' as const }
];

const navItems: { label: string; view: EmployeeView }[] = [
  { label: 'Home', view: 'home' },
  { label: 'Library', view: 'library' },
  { label: 'Profile', view: 'profile' }
];

type EmployeeDashboardTabsProps = {
  authEmail: string | null;
  contactEmail: string;
  displayName: string;
  profileError: string | null;
  updatedAtIso: string | null;
  modules: TrainingModule[];
  initialView: EmployeeView;
};

type CertificationTone = 'ok' | 'warn' | 'bad';

type EmployeeCertification = {
  name: string;
  status: string;
  tone: CertificationTone;
};

type AssignedTraining = (typeof assignedTraining)[number];

type CoachingTip = (typeof coachingTips)[number];

type RecentScore = (typeof recentScores)[number];

export default function EmployeeDashboardTabs({
  authEmail,
  contactEmail,
  displayName,
  profileError,
  updatedAtIso,
  modules,
  initialView
}: EmployeeDashboardTabsProps) {
  const [view, setView] = useState<EmployeeView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const syncViewFromLocation = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const next = normalizeEmployeeView(params.get('view'));
    setView(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      syncViewFromLocation();
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [syncViewFromLocation]);

  const updateUrl = useCallback((nextView: EmployeeView) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (nextView === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', nextView);
    }

    const search = url.searchParams.toString();
    const nextPath = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
    window.history.replaceState(null, '', nextPath);
  }, []);

  const handleSelectView = useCallback(
    (nextView: EmployeeView) => {
      setView(nextView);
      updateUrl(nextView);
    },
    [updateUrl]
  );

  const formattedUpdatedAt = useMemo(() => {
    if (!updatedAtIso) return null;
    const parsed = new Date(updatedAtIso);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  }, [updatedAtIso]);

  return (
    <>
      {view === 'home' && (
        <EmployeeHome
          updatedAt={formattedUpdatedAt}
          profileError={profileError}
          onOpenLibrary={() => handleSelectView('library')}
        />
      )}
      {view === 'library' && (
        <EmployeeTrainingLibrary modules={modules} onBack={() => handleSelectView('home')} />
      )}
      {view === 'profile' && (
        <EmployeeProfileView
          displayName={displayName}
          contactEmail={contactEmail}
          authEmail={authEmail}
          updatedAt={formattedUpdatedAt}
          profileError={profileError}
          onBack={() => handleSelectView('home')}
        />
      )}

      <nav className="employee-dashboard__nav" aria-label="Employee navigation">
        {navItems.map((item) => {
          const isActive = item.view === view;
          return (
            <button
              key={item.view}
              type="button"
              className={`employee-dashboard__nav-item${
                isActive ? ' employee-dashboard__nav-item--active' : ''
              }`}
              aria-pressed={isActive}
              onClick={() => handleSelectView(item.view)}
            >
              <span className="employee-dashboard__nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

type EmployeeHomeProps = {
  updatedAt: string | null;
  profileError: string | null;
  onOpenLibrary: () => void;
};

function EmployeeHome({ updatedAt, profileError, onOpenLibrary }: EmployeeHomeProps) {
  return (
    <div className="employee-dashboard">
      <header className="employee-dashboard__header">
        <p className="employee-dashboard__eyebrow">Welcome back</p>
        <h1 className="employee-dashboard__title">Employee Dashboard</h1>
      </header>
      {updatedAt && <p className="employee-dashboard__timestamp">Last updated {updatedAt}</p>}
      {profileError && <p className="employee-dashboard__error">{profileError}</p>}

      <div className="employee-dashboard__metrics">
        {quickMetrics.map((metric) => (
          <div key={metric.label} className="employee-dashboard__metric">
            <span className="employee-dashboard__metric-label">{metric.label}</span>
            <span className="employee-dashboard__metric-value">{metric.value}</span>
          </div>
        ))}
      </div>

      <EmployeeAssignedTraining trainings={assignedTraining} />
      <EmployeeRecentScores scores={recentScores} onSeeAll={onOpenLibrary} />
      <EmployeeCoachingTips tips={coachingTips} />
    </div>
  );
}

type EmployeeAssignedTrainingProps = {
  trainings: AssignedTraining[];
};

function EmployeeAssignedTraining({ trainings }: EmployeeAssignedTrainingProps) {
  return (
    <section className="employee-dashboard__card">
      <h2 className="employee-dashboard__card-title">Assigned Training</h2>
      <div className="employee-dashboard__rows">
        {trainings.map((training) => (
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
  );
}

type EmployeeRecentScoresProps = {
  scores: RecentScore[];
  onSeeAll: () => void;
};

function EmployeeRecentScores({ scores, onSeeAll }: EmployeeRecentScoresProps) {
  return (
    <section className="employee-dashboard__card">
      <div className="employee-dashboard__card-header">
        <h2 className="employee-dashboard__card-title">Recent Scores</h2>
        <Link
          href="/app?view=library"
          className="employee-dashboard__action"
          onClick={(event) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.button !== 0) {
              return;
            }
            event.preventDefault();
            onSeeAll();
          }}
        >
          See all
        </Link>
      </div>
      <div className="employee-dashboard__rows">
        {scores.map((score) => (
          <div key={score.label} className="employee-dashboard__row">
            <span className="employee-dashboard__row-title">{score.label}</span>
            <span className="employee-dashboard__row-meta">{score.meta}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type EmployeeCoachingTipsProps = {
  tips: CoachingTip[];
};

function EmployeeCoachingTips({ tips }: EmployeeCoachingTipsProps) {
  return (
    <section className="employee-dashboard__card">
      <h2 className="employee-dashboard__card-title">Personal Coaching Tips</h2>
      <ul className="employee-dashboard__tips">
        {tips.map((tip) => (
          <li key={tip.text} className="employee-dashboard__tip">
            <span className="employee-dashboard__tip-icon" aria-hidden="true">
              {tip.icon}
            </span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type EmployeeProfileViewProps = {
  displayName: string;
  contactEmail: string;
  authEmail: string | null;
  updatedAt: string | null;
  profileError: string | null;
  onBack: () => void;
};

function EmployeeProfileView({
  displayName,
  contactEmail,
  authEmail,
  updatedAt,
  profileError,
  onBack
}: EmployeeProfileViewProps) {
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="employee-profile">
      <div className="employee-topbar">
        <button type="button" className="employee-topbar__back" aria-label="Back to Home" onClick={onBack}>
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
        </button>
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
        {authEmail && <p className="employee-profile__meta-line">Signed in as {authEmail}</p>}
        {updatedAt && (
          <p className="employee-profile__meta-line">Profile updated {updatedAt}</p>
        )}
        {profileError && <p className="employee-profile__meta-error">{profileError}</p>}
      </div>
    </div>
  );
}
