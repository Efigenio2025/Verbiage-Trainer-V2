export type TrainingModuleStatus = 'In progress' | 'Assigned' | 'Not started';

export type TrainingModule = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  status: TrainingModuleStatus;
  duration: string;
  progress: number;
  level: 'Foundation' | 'Intermediate' | 'Advanced';
  focusAreas: string[];
  outcomes: string[];
  nextAction: string;
};

export type TrainingMilestone = {
  id: string;
  moduleSlug: string;
  title: string;
  description: string;
  due: string;
};

export const trainingLibrary: TrainingModule[] = [
  {
    slug: 'phonetic-alphabet',
    title: 'Phonetic Alphabet Drills',
    summary: 'Sharpen clarity of radio transmissions with timed runway and gate scenarios.',
    description:
      'Work through scenario-based transmissions with timed recall to reinforce NATO phonetics under peak-traffic pressure.',
    category: 'Phonetic',
    status: 'In progress',
    duration: '15 minutes',
    progress: 68,
    level: 'Foundation',
    focusAreas: ['Gate departure clearances', 'Rapid response callouts', 'Crew readbacks'],
    outcomes: [
      'Deliver callouts with 95% accuracy across mixed flight rosters.',
      'Hold response cadence under five seconds for urgent instructions.',
      'Coach teammates on misreads using standardized correction phrasing.'
    ],
    nextAction: 'Resume Scenario 3: Peak-hour pushback coordination'
  },
  {
    slug: 'de-ice-procedures',
    title: 'De-ice Procedures Simulation',
    summary: 'Rehearse coordinated cold-weather operations and complete pre-takeoff checklists.',
    description:
      'Step through multi-crew de-ice communications while validating holdover calculations and safety verifications.',
    category: 'De-ice',
    status: 'Assigned',
    duration: '20 minutes',
    progress: 22,
    level: 'Intermediate',
    focusAreas: ['Type IV fluid briefings', 'Holdover monitoring', 'Cabin status updates'],
    outcomes: [
      'Call the correct fluid type and sequence without referencing prompts.',
      'Document de-ice status updates with compliant phraseology.',
      'Coordinate with ground teams while maintaining sterile cockpit tone.'
    ],
    nextAction: 'Review holdover timer drill before tonight\'s shift'
  },
  {
    slug: 'movement-briefings',
    title: 'Movement & Pushback Briefings',
    summary: 'Lead safe taxi and pushback communications for congested apron environments.',
    description:
      'Coordinate crew, tower, and tug responsibilities in complex ramp layouts to eliminate radio conflicts.',
    category: 'Movement',
    status: 'Not started',
    duration: '12 minutes',
    progress: 0,
    level: 'Advanced',
    focusAreas: ['Tug handoff scripts', 'Hot-spot avoidance', 'Ramp situational updates'],
    outcomes: [
      'Sequence pushback duties with zero conflicting instructions.',
      'Flag airfield hot-spots before ground taxi begins.',
      'Lead post-briefing recap that captures actionable ramp risks.'
    ],
    nextAction: 'Walk through pushback briefing checklist with your supervisor'
  }
];

export const trainingMilestones: TrainingMilestone[] = [
  {
    id: 'phonetic-check',
    moduleSlug: 'phonetic-alphabet',
    title: 'Phonetic scenario evaluation',
    description: 'Complete Scenario 3 with at least 90% callout accuracy.',
    due: 'Due April 12'
  },
  {
    id: 'de-ice-audit',
    moduleSlug: 'de-ice-procedures',
    title: 'De-ice audit review',
    description: 'Submit holdover documentation for yesterday\'s simulated sortie.',
    due: 'Due April 15'
  },
  {
    id: 'movement-observation',
    moduleSlug: 'movement-briefings',
    title: 'Movement observation ride',
    description: 'Shadow a lead dispatcher and capture three ramp risk notes.',
    due: 'Due April 19'
  }
];

export function getTrainingModule(slug: string): TrainingModule | undefined {
  return trainingLibrary.find((module) => module.slug === slug);
}

export function getActiveTrainingModule(): TrainingModule | undefined {
  return trainingLibrary.find((module) => module.status === 'In progress') ?? trainingLibrary[0];
}
