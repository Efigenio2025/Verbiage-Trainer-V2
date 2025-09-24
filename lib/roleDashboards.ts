export type StatusTone = 'success' | 'warning' | 'info' | 'alert';

export type SnapshotMetric = {
  label: string;
  value: string;
  helper: string;
};

export type TeamMemberReadiness = {
  name: string;
  role: string;
  coverage: string;
  focusModule: string;
  progress: number;
  status: string;
  tone: StatusTone;
  nextCheckpoint: string;
  note: string;
};

export type CoachingMoment = {
  id: string;
  moduleSlug: string;
  title: string;
  description: string;
  person: string;
  due: string;
};

export type OperationalSignal = {
  id: string;
  title: string;
  status: string;
  tone: StatusTone;
  detail: string;
};

export const managerSnapshotMetrics: SnapshotMetric[] = [
  {
    label: 'Team readiness index',
    value: '82%',
    helper: '+5% vs last rotation'
  },
  {
    label: 'Sessions scheduled',
    value: '6',
    helper: '3 today · 3 tomorrow'
  },
  {
    label: 'Escalations',
    value: '1 open',
    helper: 'De-ice checklist review'
  }
];

export const managerTeamReadiness: TeamMemberReadiness[] = [
  {
    name: 'Maya Chen',
    role: 'Ramp Coordinator',
    coverage: 'Overnight crew',
    focusModule: 'De-ice Procedures Simulation',
    progress: 82,
    status: 'On track',
    tone: 'success',
    nextCheckpoint: 'Check-in Fri · 09:30',
    note: 'Prep holdover timer refresher ahead of incoming storm cycle.'
  },
  {
    name: 'Luis Romero',
    role: 'Tower Liaison',
    coverage: 'Day shift',
    focusModule: 'Phonetic Alphabet Drills',
    progress: 64,
    status: 'Needs coaching',
    tone: 'warning',
    nextCheckpoint: 'Shadow Tue · 14:15',
    note: 'Struggling with peak-hour cadence—plan live readback practice.'
  },
  {
    name: 'Priya Singh',
    role: 'Gate Lead',
    coverage: 'Swing shift',
    focusModule: 'Movement & Pushback Briefings',
    progress: 48,
    status: 'New assignment',
    tone: 'info',
    nextCheckpoint: 'Brief Wed · 11:00',
    note: 'Kickoff focus on tug handoff scripts with tug supervisor.'
  }
];

export const managerCoachingMoments: CoachingMoment[] = [
  {
    id: 'coach-maya',
    moduleSlug: 'de-ice-procedures',
    title: 'Run de-ice rehearsal with Maya',
    description: 'Walk the type IV callouts using last year\'s incident log before the weekend snow.',
    person: 'Maya Chen',
    due: 'Due in 2 days'
  },
  {
    id: 'coach-luis',
    moduleSlug: 'phonetic-alphabet',
    title: 'Shadow Luis during peak bank',
    description: 'Capture three callouts for playback review and build a corrective script library.',
    person: 'Luis Romero',
    due: 'Due tomorrow'
  },
  {
    id: 'coach-priya',
    moduleSlug: 'movement-briefings',
    title: 'Prep Priya for ramp observation',
    description: 'Assign observation checklist and confirm with tug team on updated hot-spot map.',
    person: 'Priya Singh',
    due: 'Due Friday'
  }
];

export const managerOperationalSignals: OperationalSignal[] = [
  {
    id: 'signal-weather',
    title: 'Weather watch',
    status: 'Monitor',
    tone: 'warning',
    detail: 'Snow band forecast between 03:00–08:00. Verify de-ice trucks staged.'
  },
  {
    id: 'signal-staffing',
    title: 'Staffing coverage',
    status: 'Green',
    tone: 'success',
    detail: 'All swings shifts confirmed. Relief crew on standby for gate 12.'
  },
  {
    id: 'signal-audit',
    title: 'Audit reminder',
    status: 'Action needed',
    tone: 'alert',
    detail: 'Submit coaching notes from last movement briefing before Sunday night.'
  }
];

export type ProvisioningRequest = {
  id: string;
  requester: string;
  role: string;
  submitted: string;
  status: string;
  tone: StatusTone;
};

export type ComplianceTask = {
  id: string;
  title: string;
  description: string;
  due: string;
};

export const adminOperationsMetrics: SnapshotMetric[] = [
  {
    label: 'Active learners',
    value: '128',
    helper: '5 pending invites'
  },
  {
    label: 'Platform uptime',
    value: '99.98%',
    helper: '30d rolling average'
  },
  {
    label: 'Audit queue',
    value: '3 open',
    helper: 'Movement + CRM reviews'
  }
];

export const adminSystemHealth: OperationalSignal[] = [
  {
    id: 'health-auth',
    title: 'Supabase auth',
    status: 'Operational',
    tone: 'success',
    detail: 'No incidents reported in the past 24 hours.'
  },
  {
    id: 'health-storage',
    title: 'Storage & recordings',
    status: 'Capacity 72%',
    tone: 'warning',
    detail: 'Archive March sessions to reclaim 120GB before month end.'
  },
  {
    id: 'health-webhooks',
    title: 'Webhook delivery',
    status: 'Retrying',
    tone: 'alert',
    detail: '3 callbacks failing for HRIS sync. Investigate signature mismatch.'
  }
];

export const adminProvisioningQueue: ProvisioningRequest[] = [
  {
    id: 'queue-harriett',
    requester: 'Harriett Cole',
    role: 'Manager',
    submitted: '2h ago',
    status: 'Needs approval',
    tone: 'warning'
  },
  {
    id: 'queue-nolan',
    requester: 'Nolan Price',
    role: 'Employee',
    submitted: '4h ago',
    status: 'Provisioned',
    tone: 'success'
  },
  {
    id: 'queue-amelia',
    requester: 'Amelia Shaw',
    role: 'Manager',
    submitted: 'Yesterday',
    status: 'Invite sent',
    tone: 'info'
  }
];

export const adminComplianceTasks: ComplianceTask[] = [
  {
    id: 'compliance-deice',
    title: 'Log de-ice simulation evidence',
    description: 'Attach QA sign-off for March roster and flag any gaps in documentation.',
    due: 'Due April 14'
  },
  {
    id: 'compliance-audit',
    title: 'Prep quarterly audit export',
    description: 'Confirm retention settings and share encrypted export with risk team.',
    due: 'Due April 18'
  },
  {
    id: 'compliance-invite',
    title: 'Review stale invites',
    description: 'Follow up on 7 invites older than 14 days before auto-expiration.',
    due: 'Due Monday'
  }
];
