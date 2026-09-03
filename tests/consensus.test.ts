import { describe, expect, it } from 'vitest';

import {
  aggregateCandidate,
  rankCandidates,
} from '@/src/server/services/consensus';

describe('aggregateCandidate', () => {
  it('keeps a candidate nonviable while any vote is missing', () => {
    const aggregate = aggregateCandidate(
      'candidate',
      [
        { candidate_id: 'candidate', stance: 'preferred' },
        { candidate_id: 'candidate', stance: 'acceptable' },
      ],
      3,
    );

    expect(aggregate).toMatchObject({
      preferred: 1,
      acceptable: 1,
      unacceptable: 0,
      missing: 1,
      distance_to_consensus: 1,
      viable: false,
    });
  });

  it('keeps a candidate nonviable when any participant rejects it', () => {
    const aggregate = aggregateCandidate(
      'candidate',
      [
        { candidate_id: 'candidate', stance: 'preferred' },
        { candidate_id: 'candidate', stance: 'unacceptable' },
      ],
      2,
    );

    expect(aggregate.viable).toBe(false);
    expect(aggregate.distance_to_consensus).toBe(1);
  });

  it('calculates distance as unacceptable plus missing ballots', () => {
    const aggregate = aggregateCandidate(
      'candidate',
      [
        { candidate_id: 'candidate', stance: 'preferred' },
        { candidate_id: 'candidate', stance: 'unacceptable' },
        { candidate_id: 'other', stance: 'unacceptable' },
      ],
      4,
    );

    expect(aggregate).toMatchObject({
      preferred: 1,
      acceptable: 0,
      unacceptable: 1,
      missing: 2,
      distance_to_consensus: 3,
      viable: false,
    });
  });
});

describe('rankCandidates', () => {
  const base = {
    created_at: '2026-09-02T00:00:00.000Z',
    change_count: 1,
  };

  it('prefers more preferred votes among viable candidates', () => {
    const result = rankCandidates([
      {
        ...base,
        id: 'mostly-acceptable',
        aggregate: {
          preferred: 1,
          acceptable: 3,
          unacceptable: 0,
          missing: 0,
          distance_to_consensus: 0,
          viable: true,
        },
      },
      {
        ...base,
        id: 'mostly-preferred',
        aggregate: {
          preferred: 3,
          acceptable: 1,
          unacceptable: 0,
          missing: 0,
          distance_to_consensus: 0,
          viable: true,
        },
      },
    ]);

    expect(result.map((candidate) => candidate.id)).toEqual([
      'mostly-preferred',
      'mostly-acceptable',
    ]);
  });

  it('uses creation time as a stable final tie-breaker', () => {
    const aggregate = {
      preferred: 0,
      acceptable: 3,
      unacceptable: 1,
      missing: 0,
      distance_to_consensus: 1,
      viable: false,
    };
    const result = rankCandidates([
      {
        ...base,
        id: 'later',
        created_at: '2026-09-02T00:00:01.000Z',
        aggregate,
      },
      { ...base, id: 'earlier', aggregate },
    ]);

    expect(result.map((candidate) => candidate.id)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('ranks nonviable options by distance, support, preference, then changes', () => {
    const candidate = (
      id: string,
      distance: number,
      preferred: number,
      acceptable: number,
      changeCount: number,
    ) => ({
      ...base,
      id,
      change_count: changeCount,
      aggregate: {
        preferred,
        acceptable,
        unacceptable: distance,
        missing: 0,
        distance_to_consensus: distance,
        viable: false,
      },
    });
    const result = rankCandidates([
      candidate('farther', 2, 3, 0, 0),
      candidate('fewer-changes', 1, 1, 2, 1),
      candidate('more-changes', 1, 1, 2, 3),
      candidate('less-support', 1, 1, 1, 0),
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      'fewer-changes',
      'more-changes',
      'less-support',
      'farther',
    ]);
  });
});
