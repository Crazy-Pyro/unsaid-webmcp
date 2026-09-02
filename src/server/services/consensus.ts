import type { CandidateAggregate, Stance } from '@/src/shared/types';

export type BallotLike = { candidate_id: string; stance: Stance };

export function aggregateCandidate(
  candidateId: string,
  ballots: BallotLike[],
  participantCount: number,
): CandidateAggregate {
  const candidateBallots = ballots.filter(
    (ballot) => ballot.candidate_id === candidateId,
  );
  const preferred = candidateBallots.filter(
    (ballot) => ballot.stance === 'preferred',
  ).length;
  const acceptable = candidateBallots.filter(
    (ballot) => ballot.stance === 'acceptable',
  ).length;
  const unacceptable = candidateBallots.filter(
    (ballot) => ballot.stance === 'unacceptable',
  ).length;
  const missing = Math.max(0, participantCount - candidateBallots.length);

  return {
    preferred,
    acceptable,
    unacceptable,
    missing,
    distance_to_consensus: unacceptable + missing,
    viable: missing === 0 && unacceptable === 0,
  };
}

export type RankedCandidate = {
  id: string;
  created_at: string;
  change_count: number;
  aggregate: CandidateAggregate;
};

export function rankCandidates<T extends RankedCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((left, right) => {
    if (left.aggregate.viable !== right.aggregate.viable) {
      return left.aggregate.viable ? -1 : 1;
    }

    if (left.aggregate.viable) {
      const leftMinimum = left.aggregate.acceptable > 0 ? 1 : 2;
      const rightMinimum = right.aggregate.acceptable > 0 ? 1 : 2;
      return (
        rightMinimum - leftMinimum ||
        right.aggregate.preferred - left.aggregate.preferred ||
        right.aggregate.preferred * 2 + right.aggregate.acceptable -
          (left.aggregate.preferred * 2 + left.aggregate.acceptable) ||
        left.created_at.localeCompare(right.created_at)
      );
    }

    return (
      left.aggregate.distance_to_consensus -
        right.aggregate.distance_to_consensus ||
      right.aggregate.preferred + right.aggregate.acceptable -
        (left.aggregate.preferred + left.aggregate.acceptable) ||
      right.aggregate.preferred - left.aggregate.preferred ||
      left.change_count - right.change_count ||
      left.created_at.localeCompare(right.created_at)
    );
  });
}
