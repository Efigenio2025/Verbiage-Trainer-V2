'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  IdCard,
  Plane,
  Shield,
  TrendingDown,
  TrendingUp,
  Type,
  User
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const card = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl';

type View = 'home' | 'library' | 'profile' | 'detail';

type ModuleCategory = 'Phonetic' | 'De-ice' | 'Movement';

type Module = {
  id: string;
  title: string;
  description: string;
  category: ModuleCategory;
  progress: number;
  icon: LucideIcon;
};

type FilterValue = 'All' | ModuleCategory;

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-white/80">{title}</h2>
      {children}
    </section>
  );
}

type AssignedRowProps = {
  title: string;
  due: string;
};

function AssignedRow({ title, due }: AssignedRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <span className="font-medium text-white/90">{title}</span>
      <span className="text-white/60">Due {due}</span>
    </div>
  );
}

type ScoreRowProps = {
  label: string;
  score: string;
  when: string;
};

function ScoreRow({ label, score, when }: ScoreRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <div>
        <p className="font-medium text-white/90">{label}</p>
        <p className="text-xs text-white/60">{when}</p>
      </div>
      <span className="text-base font-semibold text-white">{score}</span>
    </div>
  );
}

type ProgressBarProps = {
  value: number;
};

function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

type FilterChipsProps = {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
};

function FilterChips({ value, onChange }: FilterChipsProps) {
  const chips: FilterValue[] = ['All', 'Phonetic', 'De-ice', 'Movement'];
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onChange(chip)}
          className={cn(
            'whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors',
            value === chip
              ? 'border-white/30 bg-white/20 text-white'
              : 'border-white/10 bg-white/5 text-white/70 hover:text-white'
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

type ModuleCardProps = {
  module: Module;
  onOpen: (module: Module) => void;
};

function ModuleCard({ module, onOpen }: ModuleCardProps) {
  const Icon = module.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(module)}
      className={cn(
        card,
        'flex w-full flex-col items-start gap-3 rounded-2xl p-4 text-left transition-transform hover:scale-[0.99] active:scale-[0.98]'
      )}
    >
      <div className="flex w-full items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-white">{module.title}</p>
          <p className="text-xs text-white/70">{module.description}</p>
        </div>
        <span className="text-sm font-medium text-white/80">{module.progress}%</span>
      </div>
      <ProgressBar value={module.progress} />
    </button>
  );
}

function PersonalCoachingTips() {
  const sessions = [
    { module: 'Phonetic Alphabet', accuracy: 86, responseSec: 4.4 },
    { module: 'De-ice Callouts', accuracy: 90, responseSec: 4.7 },
    { module: 'Pushback Script', accuracy: 92, responseSec: 4.5 }
  ];

  const latest = sessions[0];
  const oldest = sessions[sessions.length - 1];
  const accuracyDelta = latest.accuracy - oldest.accuracy;
  const responseDelta = latest.responseSec - oldest.responseSec;

  const bestSession = sessions.reduce((prev, curr) => (curr.accuracy > prev.accuracy ? curr : prev));

  const accuracyImproving = accuracyDelta > 0;
  const accuracyIcon = accuracyDelta === 0 ? Activity : accuracyImproving ? TrendingUp : TrendingDown;

  const responseImproving = responseDelta < 0;
  const responseIcon = responseDelta === 0 ? Activity : responseImproving ? TrendingUp : TrendingDown;

  const stableModule = sessions.find((session) => session.module === bestSession.module) ?? latest;

  const bullets = [
    {
      icon: accuracyIcon,
      text:
        accuracyDelta === 0
          ? 'Accuracy holding steady across recent drills. Keep reinforcing fundamentals.'
          : accuracyImproving
          ? `Accuracy up ${Math.abs(accuracyDelta)} pts. Keep the momentum in ${latest.module}.`
          : `Accuracy down ${Math.abs(accuracyDelta)} pts. Revisit ${latest.module} prompts.`
    },
    {
      icon: responseIcon,
      text:
        responseDelta === 0
          ? 'Response pacing is consistent. Maintain cadence with timed reps.'
          : responseImproving
          ? `Response speed improved by ${Math.abs(responseDelta).toFixed(1)}s. Great reflexes!`
          : `Responses slowed by ${Math.abs(responseDelta).toFixed(1)}s. Practice rapid callbacks.`
    },
    {
      icon: Activity,
      text: `${stableModule.module} remains your strongest module at ${stableModule.accuracy}% accuracy.`
    }
  ];

  return (
    <div className={cn(card, 'p-4')}>
      <h3 className="text-base font-semibold text-white">Personal Coaching Tips</h3>
      <ul className="mt-3 space-y-3 text-sm text-white/85">
        {bullets.map((item, idx) => {
          const Icon = item.icon;
          return (
            <li key={idx} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white">
                <Icon className="h-4 w-4" />
              </span>
              <span className="leading-relaxed text-white/85">{item.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type BottomBarProps = {
  view: Extract<View, 'home' | 'library' | 'profile'>;
  onChange: (view: Extract<View, 'home' | 'library' | 'profile'>) => void;
};

function BottomBar({ view, onChange }: BottomBarProps) {
  const items: Array<{ key: Extract<View, 'home' | 'library' | 'profile'>; label: string; icon: LucideIcon }> = [
    { key: 'home', label: 'Home', icon: User },
    { key: 'library', label: 'Library', icon: BookOpen },
    { key: 'profile', label: 'Profile', icon: IdCard }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={cn(
        card,
        'fixed bottom-4 left-1/2 z-10 flex w-[min(100%-2rem,28rem)] -translate-x-1/2 items-center justify-between gap-1 px-2 py-1 text-sm shadow-lg'
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-all',
              active ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

type HomeScreenProps = {
  onOpenLibrary: () => void;
};

function HomeScreen({ onOpenLibrary }: HomeScreenProps) {
  return (
    <div className="space-y-6 pb-24">
      <header className="text-center">
        <p className="text-xs text-white/70">Welcome back</p>
        <h1 className="text-lg font-semibold text-white">Employee Dashboard</h1>
      </header>
      <Section title="Assigned Training">
        <div className={cn(card, 'divide-y divide-white/5')}>
          <AssignedRow title="De-ice Verbiage – Level 1" due="Fri" />
          <AssignedRow title="Phonetic Alphabet – Accuracy" due="Today" />
          <AssignedRow title="Aircraft Movement – Tow & Push" due="Mon" />
        </div>
      </Section>
      <Section title="Recent Scores">
        <div className={cn(card, 'divide-y divide-white/5')}>
          <ScoreRow label="De-ice Callouts Drill" score="92%" when="Yesterday 14:20" />
          <ScoreRow label="Phonetic Alphabet Speed" score="88%" when="2 days ago" />
          <ScoreRow label="Pushback Script" score="95%" when="Last week" />
        </div>
      </Section>
      <PersonalCoachingTips />
      <button
        type="button"
        onClick={onOpenLibrary}
        className="w-full rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
      >
        Browse Training Library
      </button>
    </div>
  );
}

type TrainingLibraryProps = {
  filter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  modules: Module[];
  onBack: () => void;
  onOpen: (module: Module) => void;
};

function TrainingLibrary({ filter, onFilterChange, modules, onBack, onOpen }: TrainingLibraryProps) {
  const filtered = useMemo(
    () => modules.filter((module) => filter === 'All' || module.category === filter),
    [modules, filter]
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Training Library</h1>
      </div>
      <FilterChips value={filter} onChange={onFilterChange} />
      <div className="space-y-4">
        {filtered.map((module) => (
          <ModuleCard key={module.id} module={module} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

type ProfileScreenProps = {
  onBack: () => void;
  onSignOut: () => void;
  userEmail: string | null;
  userRole: string | null;
  profileUpdatedAt: string | null;
  profileError: string | null;
};

function ProfileScreen({ onBack, onSignOut, userEmail, userRole, profileUpdatedAt, profileError }: ProfileScreenProps) {
  const badges = ['De-ice Pro', 'Phonetic Sprinter', 'Safety First'];
  const certifications = [
    { title: 'De-ice Procedures', status: 'Valid • 2026-02' },
    { title: 'Aircraft Movement', status: 'Valid • 2025-12' }
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Profile</h1>
      </div>
      <div className={cn(card, 'flex items-center justify-between gap-3 p-4')}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">{userEmail ?? 'Employee'}</p>
            <p className="text-xs text-white/70">{userRole ? `${userRole} • Active` : 'Ramp Operations • OMA'}</p>
          </div>
        </div>
        <IdCard className="h-6 w-6 text-white/70" />
      </div>
      {profileUpdatedAt && (
        <div className={cn(card, 'p-4 text-sm text-white/70')}>
          <p>Last profile update {new Date(profileUpdatedAt).toLocaleString()}</p>
        </div>
      )}
      {profileError && (
        <div className={cn(card, 'p-4 text-sm text-white/80')}>
          <p className="text-red-200">{profileError}</p>
        </div>
      )}
      <div className={cn(card, 'p-4')}>
        <h3 className="text-sm font-semibold text-white/80">Badges</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className={cn(card, 'p-4')}>
        <h3 className="text-sm font-semibold text-white/80">Certifications</h3>
        <div className="mt-3 space-y-3 text-sm">
          {certifications.map((item) => (
            <div key={item.title} className="flex items-center justify-between text-white/85">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-white/60">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={cn(card, 'p-4')}>
        <h3 className="text-sm font-semibold text-white/80">Preferences</h3>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 h-12 w-full rounded-xl border border-white/15 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

type TrainingDetailProps = {
  module: Module;
  onBack: () => void;
};

function TrainingDetail({ module, onBack }: TrainingDetailProps) {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{module.title}</h1>
      </div>
      <div className={cn(card, 'p-5 text-sm text-white/80')}>
        Coming soon: choose level and start/resume.
      </div>
    </div>
  );
}

type EmployeeAppClientProps = {
  userEmail: string | null;
  userRole: string | null;
  profileUpdatedAt: string | null;
  profileError: string | null;
};

const modules: Module[] = [
  {
    id: 'phonetic',
    title: 'Phonetic Alphabet',
    description: 'NATO letters A–Z drills',
    category: 'Phonetic',
    progress: 60,
    icon: Type
  },
  {
    id: 'deice',
    title: 'De-ice Verbiage',
    description: 'Callouts & confirmations',
    category: 'De-ice',
    progress: 35,
    icon: BookOpen
  },
  {
    id: 'movement',
    title: 'Aircraft Movement',
    description: 'Tow & Pushback wording',
    category: 'Movement',
    progress: 10,
    icon: Plane
  }
];

export default function EmployeeAppClient({ userEmail, userRole, profileUpdatedAt, profileError }: EmployeeAppClientProps) {
  const router = useRouter();
  const [view, setView] = useState<View>('home');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<FilterValue>('All');

  const handleOpenLibrary = useCallback(() => {
    setView('library');
  }, []);

  const handleModuleOpen = useCallback((module: Module) => {
    setSelectedModule(module);
    setView('detail');
  }, []);

  const handleBackToLibrary = useCallback(() => {
    setView('library');
  }, []);

  const handleBottomNavChange = useCallback((next: Extract<View, 'home' | 'library' | 'profile'>) => {
    setView(next);
    setSelectedModule(null);
  }, []);

  const handleSignOut = useCallback(() => {
    router.push('/auth/logout');
  }, [router]);

  const showBottomBar = view === 'home' || view === 'library' || view === 'profile';
  const containerClass = view === 'detail' ? 'mx-auto w-full max-w-xl px-4 pb-12 pt-10' : 'mx-auto w-full max-w-xl px-4 pb-28 pt-10';

  return (
    <div className="w-full">
      <div className="min-h-[calc(100vh-96px)] bg-gradient-to-b from-ashwoodTop to-ashwoodBottom text-white">
        <div className={containerClass}>
          <div className={cn(card, 'mb-6 flex items-center gap-4 px-5 py-4')}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-white/70">Piedmont Ops Training</p>
              <h1 className="text-lg font-semibold text-white">Verbiage Readiness</h1>
            </div>
            <div className="text-right text-xs text-white/60">
              <p>{userEmail ?? 'employee@piedmontair.com'}</p>
              <p>{userRole ? userRole.toUpperCase() : 'EMPLOYEE'}</p>
            </div>
          </div>
          {view === 'home' && <HomeScreen onOpenLibrary={handleOpenLibrary} />}
          {view === 'library' && (
            <TrainingLibrary
              filter={libraryFilter}
              onFilterChange={setLibraryFilter}
              modules={modules}
              onBack={() => setView('home')}
              onOpen={handleModuleOpen}
            />
          )}
          {view === 'profile' && (
            <ProfileScreen
              onBack={() => setView('home')}
              onSignOut={handleSignOut}
              userEmail={userEmail}
              userRole={userRole}
              profileUpdatedAt={profileUpdatedAt}
              profileError={profileError}
            />
          )}
          {view === 'detail' && selectedModule && <TrainingDetail module={selectedModule} onBack={handleBackToLibrary} />}
        </div>
        {showBottomBar && <BottomBar view={view as Extract<View, 'home' | 'library' | 'profile'>} onChange={handleBottomNavChange} />}
      </div>
    </div>
  );
}
