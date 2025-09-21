import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
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
  User,
} from 'lucide-react';
import './index.css';

type View = 'login' | 'home' | 'library' | 'profile' | 'detail';
type FilterValue = 'All' | 'Phonetic' | 'De-ice' | 'Movement';

type Module = {
  id: string;
  title: string;
  description: string;
  progress: number;
  category: 'Phonetic' | 'De-ice' | 'Movement';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const modules: Module[] = [
  {
    id: 'phonetic',
    title: 'Phonetic Alphabet',
    description: 'NATO letters A–Z drills',
    progress: 60,
    category: 'Phonetic',
    icon: Type,
  },
  {
    id: 'deice',
    title: 'De-ice Verbiage',
    description: 'Callouts & confirmations',
    progress: 35,
    category: 'De-ice',
    icon: BookOpen,
  },
  {
    id: 'movement',
    title: 'Aircraft Movement',
    description: 'Tow & Pushback wording',
    progress: 10,
    category: 'Movement',
    icon: Plane,
  },
];

const card = 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl';

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70">{title}</h2>
    {children}
  </section>
);

const AssignedRow: React.FC<{ title: string; due: string }> = ({ title, due }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
    <div>
      <p className="font-medium text-white">{title}</p>
      <p className="text-xs text-white/70">Due {due}</p>
    </div>
    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white/70">Assigned</span>
  </div>
);

const ScoreRow: React.FC<{ label: string; score: string; when: string }> = ({ label, score, when }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
    <div>
      <p className="font-medium text-white">{label}</p>
      <p className="text-xs text-white/60">{when}</p>
    </div>
    <span className="text-sm font-semibold text-white">{score}</span>
  </div>
);

const FilterChips: React.FC<{ value: FilterValue; onChange: (value: FilterValue) => void }> = ({ value, onChange }) => {
  const chips: FilterValue[] = ['All', 'Phonetic', 'De-ice', 'Movement'];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((chip) => {
        const active = value === chip;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(chip)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition',
              active ? 'bg-white/20 text-white shadow-inner' : 'bg-white/5 text-white/80 hover:text-white'
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
};

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
    <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

const ModuleCard: React.FC<{ m: Module; onOpen: (module: Module) => void }> = ({ m, onOpen }) => {
  const Icon = m.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className={cn(
        card,
        'flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/10 active:scale-[0.99]'
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 space-y-2">
        <div>
          <h3 className="text-base font-semibold text-white">{m.title}</h3>
          <p className="text-xs text-white/70">{m.description}</p>
        </div>
        <ProgressBar value={m.progress} />
        <p className="text-xs text-white/60">{m.progress}% complete</p>
      </div>
    </button>
  );
};

const PersonalCoachingTips: React.FC = () => {
  const sessions = useMemo(
    () => [
      { module: 'Phonetic Alphabet', accuracy: 86, responseSec: 4.4 },
      { module: 'De-ice Callouts', accuracy: 90, responseSec: 4.7 },
      { module: 'Pushback Script', accuracy: 92, responseSec: 4.5 },
    ],
    []
  );

  const latest = sessions[0];
  const oldest = sessions[sessions.length - 1];
  const accuracyDelta = latest.accuracy - oldest.accuracy;
  const responseDelta = latest.responseSec - oldest.responseSec;

  const lowestAccuracySession = sessions.reduce((prev, curr) => (curr.accuracy < prev.accuracy ? curr : prev));
  const strongestSession = sessions.reduce((prev, curr) => (curr.accuracy > prev.accuracy ? curr : prev));

  const accuracyTrendIcon = accuracyDelta > 1 ? TrendingUp : accuracyDelta < -1 ? TrendingDown : Activity;
  const responseTrendIcon = responseDelta < -0.05 ? TrendingUp : responseDelta > 0.05 ? TrendingDown : Activity;

  const accuracyMessage =
    accuracyDelta > 1
      ? `Accuracy climbing ${Math.abs(accuracyDelta).toFixed(0)} pts — keep leaning on ${latest.module}.`
      : accuracyDelta < -1
      ? `Accuracy slipped ${Math.abs(accuracyDelta).toFixed(0)} pts since ${oldest.module}; revisit fundamentals.`
      : 'Accuracy holding steady across recent drills — maintain consistent reps.';

  const responseMessage =
    responseDelta < -0.05
      ? `Response time faster by ${Math.abs(responseDelta).toFixed(1)}s — cadence is improving.`
      : responseDelta > 0.05
      ? `Response time slowed by ${Math.abs(responseDelta).toFixed(1)}s — tighten callout pacing.`
      : 'Response time steady — keep the rhythm balanced with clarity.';

  const focusMessage = `${strongestSession.module} remains strongest at ${strongestSession.accuracy}% — use it as a confidence anchor.`;

  const FocusIcon = Activity;

  return (
    <ul className="space-y-3 text-sm text-white/80">
      <li className="flex items-start gap-3">
        {React.createElement(accuracyTrendIcon, { className: 'mt-0.5 h-4 w-4 shrink-0 text-white/80' })}
        <span>{accuracyMessage}</span>
      </li>
      <li className="flex items-start gap-3">
        {React.createElement(responseTrendIcon, { className: 'mt-0.5 h-4 w-4 shrink-0 text-white/80' })}
        <span>{responseMessage}</span>
      </li>
      <li className="flex items-start gap-3">
        <FocusIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
        <span>
          {focusMessage} Focus extra reps on {lowestAccuracySession.module} at {lowestAccuracySession.accuracy}%.
        </span>
      </li>
    </ul>
  );
};

const APP_MAX_WIDTH = 430;

const BottomBar: React.FC<{
  view: 'home' | 'library' | 'profile';
  onChange: (view: 'home' | 'library' | 'profile') => void;
}> = ({ view, onChange }) => {
  const items: Array<{ key: 'home' | 'library' | 'profile'; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = [
    { key: 'home', label: 'Home', icon: User },
    { key: 'library', label: 'Library', icon: BookOpen },
    { key: 'profile', label: 'Profile', icon: IdCard },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={cn(card, 'fixed bottom-4 inset-x-0 mx-auto flex w-full justify-between py-1 backdrop-blur-2xl')}
      style={{
        maxWidth: `min(100vw, ${APP_MAX_WIDTH}px)`,
        paddingInline: 'clamp(0.5rem, 4vw, 1rem)',
      }}
    >
      {items.map((item) => {
        const active = view === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
              active ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-10 py-10">
      <div className="flex flex-col items-center gap-5">
        <div className={cn(card, 'flex h-16 w-16 items-center justify-center rounded-2xl border-white/15 bg-white/10')}>
          <Shield className="h-8 w-8 text-white/90" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-white">Piedmont Ops Training</h1>
          <p className="text-sm text-white/80">Employee login to practice critical verbiage</p>
        </div>
      </div>
      <div className={cn(card, 'w-full space-y-4 p-6')}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@piedmont.com"
            className="h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Password
            </label>
            <button type="button" className="text-xs font-semibold text-white/60 hover:text-white/80">
              Forgot?
            </button>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
        </div>
        <button
          type="button"
          onClick={onLogin}
          className="h-12 w-full rounded-xl border border-white/15 bg-white/20 text-sm font-semibold text-white transition active:scale-95"
        >
          Login
        </button>
      </div>
      <p className="px-6 text-center text-xs text-white/70">
        By continuing you agree to company training policies.
      </p>
    </div>
  );
};

const EmployeeDashboardHome: React.FC = () => (
  <div className="space-y-6 pb-8">
    <header className="space-y-1 text-center">
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
        <ScoreRow label="De-ice Callouts Drill" score="92%" when="Yesterday • 14:20" />
        <ScoreRow label="Phonetic Alphabet Speed" score="88%" when="2 days ago" />
        <ScoreRow label="Pushback Script" score="95%" when="Last week" />
      </div>
    </Section>

    <Section title="Personal Coaching Tips">
      <div className={cn(card, 'p-4')}>
        <PersonalCoachingTips />
      </div>
    </Section>
  </div>
);

const TrainingLibrary: React.FC<{
  modules: Module[];
  filter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  onOpenModule: (module: Module) => void;
  onBack: () => void;
}> = ({ modules: moduleList, filter, onFilterChange, onOpenModule, onBack }) => {
  const filteredModules = moduleList.filter((module) => filter === 'All' || module.category === filter);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(card, 'flex h-10 w-10 items-center justify-center rounded-xl bg-white/10')}
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Training Library</h1>
      </header>

      <div className={cn(card, 'p-3')}>
        <FilterChips value={filter} onChange={onFilterChange} />
      </div>

      <div className="space-y-3">
        {filteredModules.map((module) => (
          <ModuleCard key={module.id} m={module} onOpen={onOpenModule} />
        ))}
      </div>
    </div>
  );
};

const ProfileScreen: React.FC<{ onBack: () => void; onSignOut: () => void }> = ({ onBack, onSignOut }) => (
  <div className="space-y-6 pb-12">
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className={cn(card, 'flex h-10 w-10 items-center justify-center rounded-xl bg-white/10')}
      >
        <ArrowLeft className="h-5 w-5 text-white" />
      </button>
      <h1 className="text-lg font-semibold text-white">Profile</h1>
    </header>

    <div className={cn(card, 'flex items-center gap-4 p-4')}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
        <User className="h-7 w-7 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-base font-semibold text-white">Employee Name</p>
        <p className="text-sm text-white/70">Ramp Operations • OMA</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
        <IdCard className="h-5 w-5 text-white" />
      </div>
    </div>

    <Section title="Badges">
      <div className={cn(card, 'p-4')}>
        <div className="flex flex-wrap gap-2">
          {['De-ice Pro', 'Phonetic Sprinter', 'Safety First'].map((badge) => (
            <span key={badge} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <BadgeCheck className="h-3.5 w-3.5" />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </Section>

    <Section title="Certifications">
      <div className={cn(card, 'divide-y divide-white/5')}>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-white">De-ice Procedures</p>
            <p className="text-xs text-white/60">Valid • 2026-02</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Aircraft Movement</p>
            <p className="text-xs text-white/60">Valid • 2025-12</p>
          </div>
        </div>
      </div>
    </Section>

    <Section title="Preferences">
      <div className={cn(card, 'p-4')}>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full rounded-xl border border-white/15 bg-white/15 px-4 py-3 text-sm font-semibold text-white transition active:scale-95"
        >
          Sign out
        </button>
      </div>
    </Section>
  </div>
);

const TrainingDetail: React.FC<{ module: Module; onBack: () => void }> = ({ module, onBack }) => (
  <div className="space-y-6 pb-12">
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          onBack();
        }}
        className={cn(card, 'flex h-10 w-10 items-center justify-center rounded-xl bg-white/10')}
      >
        <ArrowLeft className="h-5 w-5 text-white" />
      </button>
      <h1 className="text-lg font-semibold text-white">{module.title}</h1>
    </header>

    <div className={cn(card, 'p-5 text-sm text-white/80')}>
      Coming soon: choose level and start/resume.
    </div>
  </div>
);

const EmployeeApp: React.FC = () => {
  const [view, setView] = useState<View>('login');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [filter, setFilter] = useState<FilterValue>('All');

  const handleOpenModule = (module: Module) => {
    setSelectedModule(module);
    setView('detail');
  };

  const handleBottomNavChange = (nextView: 'home' | 'library' | 'profile') => {
    if (nextView !== 'library') {
      setSelectedModule(null);
    }
    setView(nextView);
  };

  return (
    <div
      className="min-h-dvh w-full"
      style={{ background: 'linear-gradient(to bottom, #4b5563, #6b7280)' }}
    >
      <div
        className="mx-auto flex min-h-dvh w-full flex-col pb-24 pt-10 text-white"
        style={{
          maxWidth: `min(100vw, ${APP_MAX_WIDTH}px)`,
          paddingInline: 'clamp(1rem, 5vw, 1.5rem)',
        }}
      >
        <main className={cn('flex-1', view === 'login' ? 'flex' : '')}>
          {view === 'login' && <LoginScreen onLogin={() => setView('home')} />}
          {view === 'home' && <EmployeeDashboardHome />}
          {view === 'library' && (
            <TrainingLibrary
              modules={modules}
              filter={filter}
              onFilterChange={setFilter}
              onOpenModule={handleOpenModule}
              onBack={() => handleBottomNavChange('home')}
            />
          )}
          {view === 'profile' && (
            <ProfileScreen
              onBack={() => handleBottomNavChange('home')}
              onSignOut={() => {
                setSelectedModule(null);
                setView('login');
              }}
            />
          )}
          {view === 'detail' && selectedModule && (
            <TrainingDetail module={selectedModule} onBack={() => setView('library')} />
          )}
        </main>
      </div>
      {view !== 'login' && view !== 'detail' && (
        <BottomBar view={view as 'home' | 'library' | 'profile'} onChange={handleBottomNavChange} />
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <EmployeeApp />
  </React.StrictMode>
);
