import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoomState, ToolResult } from '@/src/shared/types';

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

import { useWebMCPTools } from '@/src/client/webmcp';

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
