import { describe, expect, it } from 'vitest';

import {
  ballotInputSchema,
  bridgeInputSchema,
  signalInputSchema,
} from '@/src/shared/schemas';

describe('tool input validation', () => {
  it('rejects extra fields', () => {
    expect(
      signalInputSchema.safeParse({
        room_version: 3,
        field: 'day',
        operator: 'equals',
        value: 'Thursday',
        visibility: 'source_hidden',
        private_reason: 'do not send this',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate ballot candidate IDs', () => {
    expect(
      ballotInputSchema.safeParse({
        room_version: 3,
        evaluations: [
          { candidate_id: 'same', stance: 'acceptable' },
          { candidate_id: 'same', stance: 'preferred' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate bridge fields and unstructured values', () => {
    expect(
      bridgeInputSchema.safeParse({
        room_version: 3,
        base_candidate_id: 'lakeside-lab',
        changes: [
          { field: 'day', value: 'Thursday' },
          { field: 'day', value: 'Friday' },
        ],
      }).success,
    ).toBe(false);

    expect(
      bridgeInputSchema.safeParse({
        room_version: 3,
        base_candidate_id: 'lakeside-lab',
        changes: [{ field: 'day', value: { narrative: 'Thursday because…' } }],
      }).success,
    ).toBe(false);
  });
});
