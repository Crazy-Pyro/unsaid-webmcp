import { getParticipantToken, storeParticipantToken } from '@/src/client/session';
import type {
  BallotInput,
  BridgeInput,
  NominationInput,
  RatificationInput,
  SignalInput,
} from '@/src/shared/schemas';
import type { RoomState, ToolResult } from '@/src/shared/types';

export class RoomClientError extends Error {
  status: number;
  code: string;
  roomVersion: number;
  retryable: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      roomVersion?: number;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = 'RoomClientError';
    this.status = options.status;
    this.code = options.code;
    this.roomVersion = options.roomVersion ?? 0;
    this.retryable = options.retryable ?? false;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    summary?: string;
    room_version?: number;
    error?: { code?: string; message?: string; retryable?: boolean };
  };
  if (!response.ok) {
    throw new RoomClientError(
      payload.error?.message ?? payload.summary ?? 'The room request failed.',
      {
        status: response.status,
        code: payload.error?.code ?? 'REQUEST_FAILED',
        roomVersion: payload.room_version,
        retryable: payload.error?.retryable,
      },
    );
  }
  return payload;
}

export async function createDemoRoom() {
  const response = await fetch('/api/demo/rooms', {
    method: 'POST',
    headers: { accept: 'application/json' },
  });
  const payload = await readResponse<{
    room_slug: string;
    participant_token: string;
    participant: { id: string; display_name: string };
  }>(response);
  storeParticipantToken(payload.room_slug, payload.participant_token);
  return payload;
}

function headers(
  slug: string,
  options: {
    origin?: 'human_ui' | 'webmcp';
    requestId?: string;
    humanIntent?: boolean;
  } = {},
) {
  const token = getParticipantToken(slug);
  if (!token) {
    throw new RoomClientError('This tab does not have a room session.', {
      status: 401,
      code: 'SESSION_MISSING',
    });
  }
  const result: Record<string, string> = {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
  };
  if (options.origin) result['x-unsaid-origin'] = options.origin;
  if (options.requestId) result['x-unsaid-request-id'] = options.requestId;
  if (options.humanIntent) result['x-unsaid-human-intent'] = 'ratify-click';
  return result;
}

export async function readRoom(slug: string, signal?: AbortSignal) {
  const response = await fetch(`/api/rooms/${encodeURIComponent(slug)}/state`, {
    headers: headers(slug),
    cache: 'no-store',
    signal,
  });
  return readResponse<RoomState>(response);
}

export async function readAgreement(slug: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/rooms/${encodeURIComponent(slug)}/agreement`,
    {
      headers: headers(slug),
      cache: 'no-store',
      signal,
    },
  );
  return readResponse<RoomState & { agreement: unknown }>(response);
}

async function mutate(
  slug: string,
  action: string,
  body: unknown,
  options: {
    origin: 'human_ui' | 'webmcp';
    signal?: AbortSignal;
    humanIntent?: boolean;
  },
) {
  const requestId = crypto.randomUUID();
  const response = await fetch(
    `/api/rooms/${encodeURIComponent(slug)}/${action}`,
    {
      method: 'POST',
      headers: {
        ...headers(slug, {
          origin: options.origin,
          requestId,
          humanIntent: options.humanIntent,
        }),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    },
  );
  return readResponse<ToolResult>(response);
}

export const roomClient = {
  begin(
    slug: string,
    roomVersion: number,
    options: { signal?: AbortSignal } = {},
  ) {
    return mutate(
      slug,
      'begin',
      { room_version: roomVersion },
      { origin: 'human_ui', ...options },
    );
  },
  submitBallot(
    slug: string,
    input: BallotInput,
    options: { origin: 'human_ui' | 'webmcp'; signal?: AbortSignal },
  ) {
    return mutate(slug, 'ballots', input, options);
  },
  publishSignal(
    slug: string,
    input: SignalInput,
    options: { origin: 'human_ui' | 'webmcp'; signal?: AbortSignal },
  ) {
    return mutate(slug, 'signals', input, options);
  },
  proposeBridge(
    slug: string,
    input: BridgeInput,
    options: { origin: 'human_ui' | 'webmcp'; signal?: AbortSignal },
  ) {
    return mutate(slug, 'bridges', input, options);
  },
  nominate(
    slug: string,
    input: NominationInput,
    options: { origin: 'human_ui' | 'webmcp'; signal?: AbortSignal },
  ) {
    return mutate(slug, 'nominations', input, options);
  },
  ratify(
    slug: string,
    input: RatificationInput,
    options: { signal?: AbortSignal } = {},
  ) {
    return mutate(slug, 'ratifications', input, {
      origin: 'human_ui',
      humanIntent: true,
      ...options,
    });
  },
};
