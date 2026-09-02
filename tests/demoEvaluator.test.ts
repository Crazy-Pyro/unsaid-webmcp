import { describe, expect, it } from 'vitest';

import {
  DEMO_PROFILES,
  evaluateDemoCandidate,
  ORIGINAL_CANDIDATES,
} from '@/src/server/services/fixtures';

describe('deterministic demo evaluator', () => {
  it('produces the intended stance for every original candidate', () => {
    const expected = {
      Maya: [
        'unacceptable',
        'unacceptable',
        'unacceptable',
        'preferred',
        'acceptable',
      ],
      Theo: [
        'unacceptable',
        'unacceptable',
        'unacceptable',
        'unacceptable',
        'acceptable',
      ],
      Sam: [
        'unacceptable',
        'acceptable',
        'unacceptable',
        'preferred',
        'unacceptable',
      ],
    } as const;

    for (const profile of DEMO_PROFILES) {
      expect(
        ORIGINAL_CANDIDATES.map((candidate) =>
          evaluateDemoCandidate(profile, candidate),
        ),
      ).toEqual(expected[profile.name]);
    }
  });

  it('accepts the intended Lakeside Thursday bridge for every demo agent', () => {
    const bridge = {
      ...ORIGINAL_CANDIDATES.find((candidate) => candidate.id === 'lakeside-lab')!,
      day: 'Thursday',
      end_time: '16:00',
      cost_per_person: 235,
    };

    expect(
      DEMO_PROFILES.map((profile) => evaluateDemoCandidate(profile, bridge)),
    ).toEqual(['preferred', 'acceptable', 'preferred']);
  });

  it('lets hard constraints override soft preferences and compares boundary times', () => {
    const maya = DEMO_PROFILES.find((profile) => profile.name === 'Maya')!;
    const sam = DEMO_PROFILES.find((profile) => profile.name === 'Sam')!;
    const lakeside = ORIGINAL_CANDIDATES.find(
      (candidate) => candidate.id === 'lakeside-lab',
    )!;

    expect(evaluateDemoCandidate(maya, { ...lakeside, start_time: '09:30' })).toBe(
      'preferred',
    );
    expect(evaluateDemoCandidate(maya, { ...lakeside, start_time: '09:29' })).toBe(
      'unacceptable',
    );
    expect(evaluateDemoCandidate(sam, { ...lakeside, end_time: '16:30' })).toBe(
      'preferred',
    );
    expect(evaluateDemoCandidate(sam, { ...lakeside, end_time: '18:30' })).toBe(
      'unacceptable',
    );
  });
});
