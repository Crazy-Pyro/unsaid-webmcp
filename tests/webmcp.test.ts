import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatAgreementToolResult,
  formatRoomStateToolResult,
  useWebMCPTools,
} from '@/src/client/webmcp';
import {
  ORIGINAL_CANDIDATES,
  SEEDED_SIGNALS,
} from '@/src/server/services/fixtures';
import type {
  PublicAuditEvent,
  PublicCandidate,
  RoomState,
  ToolResult,
} from '@/src/shared/types';

const clientMocks = vi.hoisted(() => ({
  readAgreement: vi.fn(),
  readRoom: vi.fn(),
  submitBallot: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect(effect: () => void | (() => void)) {
    effect();
  },
  useMemo<T>(factory: () => T) {
    return factory();
  },
  useRef<T>(value: T) {
    return { current: value };
  },
}));

vi.mock('@/src/client/room-client', () => ({
  readAgreement: clientMocks.readAgreement,
  readRoom: clientMocks.readRoom,
  roomClient: {
    submitBallot: clientMocks.submitBallot,
  },
}));

type CapturedTool = {
  name: string;
  execute(
    input: unknown,
    context?: { signal?: AbortSignal },
  ): unknown;
};

const collectingState = {
  room: {
    phase: 'COLLECTING',
    version: 2,
    decision_question: 'Which one-day team offsite should we choose?',
  },
  current_participant: {
    display_name: 'You',
    ballot: {},
  },
  candidates: [],
  signals: [],
  available_actions: ['get_room_state', 'submit_ballot'],
} as unknown as RoomState;

const aggregate = {
  preferred: 2,
  acceptable: 1,
  unacceptable: 1,
  missing: 0,
  distance_to_consensus: 1,
  viable: false,
};

const originalCandidates: PublicCandidate[] = ORIGINAL_CANDIDATES.map(
  (candidate, index) => ({
    ...candidate,
    source_kind: 'original',
    base_candidate_id: null,
    changes: [],
    change_count: 0,
    is_locked: false,
    created_at: `2026-09-02T00:00:0${index}.000Z`,
    aggregate,
  }),
);

const bridgeCandidate: PublicCandidate = {
  ...originalCandidates[3],
  id: 'lakeside-lab-bridge-7lv5xt',
  title: 'Lakeside Lab · Thursday Bridge',
  source_kind: 'bridge',
  base_candidate_id: 'lakeside-lab',
  day: 'Thursday',
  end_time: '16:00',
  cost_per_person: 235,
  changes: [
    { field: 'day', from: 'Friday', to: 'Thursday' },
    { field: 'end_time', from: '16:30', to: '16:00' },
    { field: 'cost_per_person', from: 260, to: 235 },
  ],
  change_count: 3,
  is_locked: true,
  aggregate: {
    preferred: 3,
    acceptable: 1,
    unacceptable: 0,
    missing: 0,
    distance_to_consensus: 0,
    viable: true,
  },
};

const auditSummaries = [
  'A fresh minimum-disclosure room was created.',
  'Three demo agents submitted structured ballots.',
  'You entered the shared decision room.',
  'Your agent submitted a structured ballot.',
  'A source-hidden structured signal was published.',
  'Your agent created a bridge from Lakeside Lab.',
  'Your agent submitted a structured ballot.',
  'Your agent nominated Lakeside Lab · Thursday Bridge for human ratification.',
  'You personally ratified Lakeside Lab · Thursday Bridge.',
];

const auditEvents: PublicAuditEvent[] = auditSummaries.map(
  (public_summary, index) => ({
    id: `event-${index}`,
    actor_kind: index < 2 ? 'system' : 'live_human',
    actor_public_label: index < 2 ? null : 'You',
    event_type: `event_${index}`,
    public_summary,
    origin: index < 2 ? 'system' : 'webmcp',
    created_at: `2026-09-02T00:00:0${index}.000Z`,
  }),
);

const fullState: RoomState = {
  room: {
    slug: 'amber-field',
    title: 'One-day team offsite',
    decision_question: 'Which one-day team offsite should we choose?',
    phase: 'READY_TO_NOMINATE',
    version: 7,
    expires_at: '2026-09-16T00:00:00.000Z',
    nominated_candidate_id: null,
  },
  current_participant: {
    id: 'p-live',
    display_name: 'You',
    is_host: true,
    ballot: Object.fromEntries(
      [...originalCandidates, bridgeCandidate].map((candidate) => [
        candidate.id,
        candidate.aggregate.viable ? 'preferred' : 'unacceptable',
      ]),
    ),
  },
  participants: [],
  candidates: [...originalCandidates, bridgeCandidate],
  signals: SEEDED_SIGNALS.map((signal, index) => ({
    ...signal,
    count: index === 0 ? 2 : 1,
    display: `${signal.field} ${signal.operator} ${String(signal.value)}`,
  })),
  audit_events: auditEvents,
  privacy: {
    raw_private_context_received: 0,
    individual_ballots: 'hidden from the shared room',
    structured_ballot_entries: 24,
    structured_signals_shared: 8,
    bridge_proposals: 1,
    agent_actions: 6,
    human_actions: 2,
  },
  available_actions: [
    'get_room_state',
    'submit_ballot',
    'nominate_candidate',
  ],
};

describe('WebMCP execution cancellation', () => {
  const registered = new Map<string, CapturedTool>();
  const refresh = vi.fn(async () => collectingState);

  beforeEach(() => {
    vi.clearAllMocks();
    registered.clear();
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('document', {
      modelContext: {
        registerTool(definition: CapturedTool) {
          registered.set(definition.name, definition);
        },
      },
    });
    clientMocks.readRoom.mockResolvedValue(collectingState);
    clientMocks.submitBallot.mockResolvedValue({
      ok: true,
      room_version: 3,
      summary: 'Ballot recorded.',
      public_effect: 'Aggregate support changed.',
    } satisfies ToolResult);

    useWebMCPTools({
      slug: 'amber-field',
      state: collectingState,
      refresh,
      onDetected: vi.fn(),
      onRegistered: vi.fn(),
      onEffect: vi.fn(),
      onError: vi.fn(),
    });
  });

  it('forwards the execution AbortSignal through reads and refreshes', async () => {
    const signal = new AbortController().signal;

    await registered.get('get_room_state')?.execute({}, { signal });

    expect(clientMocks.readRoom).toHaveBeenCalledWith('amber-field', signal);
    expect(refresh).toHaveBeenCalledWith(signal);
  });

  it('forwards the execution AbortSignal through mutations and refreshes', async () => {
    const signal = new AbortController().signal;
    const input = {
      room_version: 2,
      evaluations: [{ candidate_id: 'museum-sprint', stance: 'preferred' }],
    };

    await registered.get('submit_ballot')?.execute(input, { signal });

    expect(clientMocks.submitBallot).toHaveBeenCalledWith(
      'amber-field',
      input,
      { origin: 'webmcp', signal },
    );
    expect(refresh).toHaveBeenCalledWith(signal);
  });
});

describe('WebMCP read result envelopes', () => {
  it('keeps a complete room result compact and column-labeled', () => {
    const result = formatRoomStateToolResult(fullState);
    const data = result.data as {
      candidate_columns: string;
      candidates: unknown[][];
      current_participant: string;
      decision: string;
      phase: string;
      public_signals: string[];
      your_ballot: Record<string, string>;
    };

    expect(result).toMatchObject({
      ok: true,
      room_version: 7,
      next_actions: fullState.available_actions,
    });
    expect(data).toMatchObject({
      phase: 'READY_TO_NOMINATE',
      decision: 'Which one-day team offsite should we choose?',
      current_participant: 'You',
    });
    expect(data.candidate_columns).toBe(
      'id,title,day,time,cost_usd,travel_min,setting,access,format,prefer,accept,reject,missing,distance_to_consensus,viable',
    );
    expect(data.candidates).toHaveLength(6);
    expect(data.candidates.at(-1)).toEqual([
      bridgeCandidate.id,
      bridgeCandidate.title,
      'Thursday',
      '10:00-16:00',
      235,
      35,
      'Mixed',
      'Step-free',
      'Collaborative workshop',
      3,
      1,
      0,
      0,
      0,
      true,
    ]);
    expect(data.public_signals).toHaveLength(7);
    expect(data.public_signals[0]).toContain('×2');
    expect(Object.keys(data.your_ballot)).toHaveLength(6);
    expect(JSON.stringify(result).length).toBeLessThan(1800);
  });

  it('keeps the final receipt compact without dropping its audit history', () => {
    const agreementState = {
      ...fullState,
      room: {
        ...fullState.room,
        phase: 'AGREED' as const,
        version: 8,
        nominated_candidate_id: bridgeCandidate.id,
      },
      agreement: {},
    };
    const result = formatAgreementToolResult(agreementState);
    const data = result.data as {
      accounting: RoomState['privacy'];
      final_candidate: Record<string, unknown>;
      public_audit: string[];
      support: PublicCandidate['aggregate'];
    };

    expect(result).toMatchObject({
      ok: true,
      room_version: 8,
      summary: 'Agreement reached: Lakeside Lab · Thursday Bridge.',
    });
    expect(data.final_candidate).toMatchObject({
      id: bridgeCandidate.id,
      title: bridgeCandidate.title,
      day: bridgeCandidate.day,
      time: '10:00-16:00',
      changes: bridgeCandidate.changes,
    });
    expect(data.support).toEqual(bridgeCandidate.aggregate);
    expect(data.accounting).toEqual(fullState.privacy);
    expect(data.public_audit).toEqual(auditSummaries);
    expect(JSON.stringify(result).length).toBeLessThan(1500);
  });
});
