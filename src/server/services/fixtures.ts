import type {
  CandidateAttributes,
  CandidateFixture,
  Stance,
} from '@/src/shared/types';
export { DECISION_QUESTION, DECISION_TITLE } from '@/src/shared/product';

export const ORIGINAL_CANDIDATES: CandidateFixture[] = [
  {
    id: 'river-run',
    title: 'River Run',
    day: 'Thursday',
    start_time: '09:00',
    end_time: '18:30',
    cost_per_person: 225,
    travel_minutes: 75,
    setting: 'Outdoor',
    accessibility: 'Rugged terrain',
    format: 'Guided activity',
  },
  {
    id: 'city-studio',
    title: 'City Studio',
    day: 'Wednesday',
    start_time: '10:00',
    end_time: '16:30',
    cost_per_person: 180,
    travel_minutes: 15,
    setting: 'Indoor',
    accessibility: 'Step-free',
    format: 'Collaborative workshop',
  },
  {
    id: 'mountain-lodge',
    title: 'Mountain Lodge',
    day: 'Thursday',
    start_time: '08:30',
    end_time: '19:00',
    cost_per_person: 320,
    travel_minutes: 110,
    setting: 'Mixed',
    accessibility: 'Step-free',
    format: 'Collaborative retreat',
  },
  {
    id: 'lakeside-lab',
    title: 'Lakeside Lab',
    day: 'Friday',
    start_time: '10:00',
    end_time: '16:30',
    cost_per_person: 260,
    travel_minutes: 35,
    setting: 'Mixed',
    accessibility: 'Step-free',
    format: 'Collaborative workshop',
  },
  {
    id: 'museum-sprint',
    title: 'Museum Sprint',
    day: 'Thursday',
    start_time: '10:30',
    end_time: '16:30',
    cost_per_person: 145,
    travel_minutes: 20,
    setting: 'Indoor',
    accessibility: 'Step-free',
    format: 'Self-directed challenge',
  },
];

type Constraint =
  | { field: 'day'; op: 'in'; values: string[] }
  | { field: 'start_time' | 'end_time'; op: 'gte' | 'lte'; value: string }
  | {
      field: 'cost_per_person' | 'travel_minutes';
      op: 'lte';
      value: number;
    }
  | {
      field: 'accessibility' | 'format';
      op: 'equals';
      value: string;
    };

export type DemoProfile = {
  name: 'Maya' | 'Theo' | 'Sam';
  initials: string;
  hard: Constraint[];
  softMatches: (candidate: CandidateAttributes) => number;
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    name: 'Maya',
    initials: 'MA',
    hard: [
      { field: 'accessibility', op: 'equals', value: 'Step-free' },
      { field: 'start_time', op: 'gte', value: '09:30' },
      { field: 'day', op: 'in', values: ['Thursday', 'Friday'] },
    ],
    softMatches: (candidate) =>
      Number(candidate.setting === 'Mixed') +
      Number(candidate.format.includes('workshop')),
  },
  {
    name: 'Theo',
    initials: 'TH',
    hard: [
      { field: 'day', op: 'in', values: ['Thursday'] },
      { field: 'cost_per_person', op: 'lte', value: 240 },
      { field: 'travel_minutes', op: 'lte', value: 60 },
    ],
    softMatches: (candidate) =>
      Number(candidate.setting === 'Outdoor' || candidate.setting === 'Mixed') +
      Number(
        candidate.format.includes('Guided') ||
          candidate.format.includes('challenge'),
      ),
  },
  {
    name: 'Sam',
    initials: 'SA',
    hard: [
      { field: 'end_time', op: 'lte', value: '16:30' },
      { field: 'format', op: 'equals', value: 'Collaborative workshop' },
    ],
    softMatches: (candidate) =>
      Number(candidate.setting === 'Mixed') +
      Number(candidate.format.includes('workshop')),
  },
];

export const SEEDED_SIGNALS = [
  { field: 'day', operator: 'equals', value: 'Thursday' },
  { field: 'end_time', operator: 'at_or_before', value: '16:30' },
  { field: 'cost_per_person', operator: 'at_most', value: 240 },
  { field: 'travel_minutes', operator: 'at_most', value: 60 },
  { field: 'accessibility', operator: 'requires', value: 'Step-free' },
  { field: 'format', operator: 'requires', value: 'Collaborative workshop' },
  { field: 'setting', operator: 'prefers', value: 'Mixed' },
] as const;

function satisfiesConstraint(
  candidate: CandidateAttributes,
  constraint: Constraint,
) {
  const value = candidate[constraint.field];
  if (constraint.op === 'in') return constraint.values.includes(String(value));
  if (constraint.op === 'lte') return value <= constraint.value;
  if (constraint.op === 'gte') return value >= constraint.value;
  return value === constraint.value;
}

export function evaluateDemoCandidate(
  profile: DemoProfile,
  candidate: CandidateAttributes,
): Stance {
  if (!profile.hard.every((constraint) => satisfiesConstraint(candidate, constraint))) {
    return 'unacceptable';
  }
  return profile.softMatches(candidate) >= 2 ? 'preferred' : 'acceptable';
}
