import { ensureSchema, getD1 } from '@/db';
import {
  aggregateCandidate,
  rankCandidates,
  type BallotLike,
} from '@/src/server/services/consensus';
import {
  DECISION_QUESTION,
  DECISION_TITLE,
  DEMO_PROFILES,
  evaluateDemoCandidate,
  ORIGINAL_CANDIDATES,
  SEEDED_SIGNALS,
} from '@/src/server/services/fixtures';
import type {
  CandidateAttributes,
  CandidateChange,
  CandidateField,
  PublicAuditEvent,
  PublicCandidate,
  PublicParticipant,
  PublicSignal,
  RoomPhase,
  RoomState,
  Stance,
  ToolResult,
} from '@/src/shared/types';
import type {
  BallotInput,
  BridgeInput,
  NominationInput,
  RatificationInput,
  SignalInput,
} from '@/src/shared/schemas';

type RoomRow = {
  id: string;
  slug: string;
  decision_question: string;
  title: string;
  phase: RoomPhase;
  version: number;
  nominated_candidate_id: string | null;
  demo_mode: number;
  created_at: string;
  expires_at: string;
  agreed_at: string | null;
};

type ParticipantRow = {
  id: string;
  room_id: string;
  display_name: string;
  actor_kind: 'live_human' | 'demo_agent';
  is_host: number;
  status: string;
  joined_at: string;
};

type CandidateRow = {
  room_id: string;
  id: string;
  base_candidate_id: string | null;
  title: string;
  source_kind: 'original' | 'bridge';
  day: string;
  start_time: string;
  end_time: string;
  cost_per_person: number;
  travel_minutes: number;
  setting: string;
  accessibility: string;
  format: string;
  proposed_by_participant_id: string | null;
  change_count: number;
  changes_json: string;
  proposal_fingerprint: string | null;
  is_active: number;
  is_locked: number;
  created_at: string;
};

type BallotRow = BallotLike & {
  room_id: string;
  participant_id: string;
  updated_at: string;
};

type SignalRow = {
  id: string;
  room_id: string;
  participant_id: string;
  field: CandidateField;
  operator: string;
  value_json: string;
  public_fingerprint: string;
  created_at: string;
};

type RatificationRow = {
  room_id: string;
  participant_id: string;
  candidate_id: string;
  decision: 'approve' | 'decline';
  created_at: string;
};

type CountRow = { count: number };

export type RequestOrigin = 'human_ui' | 'webmcp';

export type AuthContext = {
  room: RoomRow;
  participant: ParticipantRow;
};

export class RoomError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  roomVersion: number;
  issues?: string[];

  constructor(
    status: number,
    code: string,
    message: string,
    options: { retryable?: boolean; roomVersion?: number; issues?: string[] } = {},
  ) {
    super(message);
    this.name = 'RoomError';
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.roomVersion = options.roomVersion ?? 0;
    this.issues = options.issues;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function randomSlug() {
  const adjectives = ['amber', 'quiet', 'luminous', 'kind', 'open', 'silver'];
  const nouns = ['field', 'harbor', 'bridge', 'clearing', 'accord', 'circle'];
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 6);
  return `${adjectives[bytes[0] % adjectives.length]}-${nouns[bytes[1] % nouns.length]}-${suffix}`;
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results;
}

function first<T>(statement: D1PreparedStatement) {
  return statement.first<T>();
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function attributesFromRow(candidate: CandidateRow): CandidateAttributes {
  return {
    day: candidate.day,
    start_time: candidate.start_time,
    end_time: candidate.end_time,
    cost_per_person: candidate.cost_per_person,
    travel_minutes: candidate.travel_minutes,
    setting: candidate.setting,
    accessibility: candidate.accessibility,
    format: candidate.format,
  };
}

export async function createDemoRoom() {
  await ensureSchema();
  const db = getD1();
  const roomId = id('room');
  const slug = randomSlug();
  const liveParticipantId = id('participant');
  const participantToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await hashToken(participantToken);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const demoParticipants = DEMO_PROFILES.map((profile) => ({
    ...profile,
    id: id('demo'),
  }));

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO rooms
          (id, slug, decision_question, title, phase, version, demo_mode, created_at, expires_at)
         VALUES (?, ?, ?, ?, 'BRIEFING', 1, 1, ?, ?)`,
      )
      .bind(roomId, slug, DECISION_QUESTION, DECISION_TITLE, createdAt, expiresAt),
    db
      .prepare(
        `INSERT INTO participants
          (id, room_id, display_name, actor_kind, token_hash, is_host, status, joined_at)
         VALUES (?, ?, 'You', 'live_human', ?, 1, 'briefing', ?)`,
      )
      .bind(liveParticipantId, roomId, tokenHash, createdAt),
  ];

  for (const participant of demoParticipants) {
    statements.push(
      db
        .prepare(
          `INSERT INTO participants
            (id, room_id, display_name, actor_kind, is_host, status, joined_at)
           VALUES (?, ?, ?, 'demo_agent', 0, 'ballot_submitted', ?)`,
        )
        .bind(participant.id, roomId, participant.name, createdAt),
    );
  }

  ORIGINAL_CANDIDATES.forEach((candidate, index) => {
    const candidateCreatedAt = new Date(
      new Date(createdAt).getTime() + index,
    ).toISOString();
    statements.push(
      db
        .prepare(
          `INSERT INTO candidates
            (room_id, id, title, source_kind, day, start_time, end_time,
             cost_per_person, travel_minutes, setting, accessibility, format,
             change_count, changes_json, is_active, is_locked, created_at)
           VALUES (?, ?, ?, 'original', ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', 1, 0, ?)`,
        )
        .bind(
          roomId,
          candidate.id,
          candidate.title,
          candidate.day,
          candidate.start_time,
          candidate.end_time,
          candidate.cost_per_person,
          candidate.travel_minutes,
          candidate.setting,
          candidate.accessibility,
          candidate.format,
          candidateCreatedAt,
        ),
    );

    demoParticipants.forEach((participant) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO ballots
              (room_id, participant_id, candidate_id, stance, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            roomId,
            participant.id,
            candidate.id,
            evaluateDemoCandidate(participant, candidate),
            createdAt,
          ),
      );
    });
  });

  SEEDED_SIGNALS.forEach((signal, index) => {
    const participant = demoParticipants[index % demoParticipants.length];
    const fingerprint = signalFingerprint(signal.field, signal.operator, signal.value);
    statements.push(
      db
        .prepare(
          `INSERT INTO coordination_signals
            (id, room_id, participant_id, field, operator, value_json,
             public_fingerprint, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id('signal'),
          roomId,
          participant.id,
          signal.field,
          signal.operator,
          JSON.stringify(signal.value),
          fingerprint,
          createdAt,
        ),
    );
  });

  statements.push(
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, origin, created_at)
         VALUES (?, ?, 'system', NULL, 'room_created',
           'A fresh minimum-disclosure room was created.', 'system', ?)`,
      )
      .bind(id('event'), roomId, createdAt),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, origin, created_at)
         VALUES (?, ?, 'demo_agent', 'Demo agents', 'fixture_ballots',
           'Three demo agents submitted structured ballots.', 'demo_fixture', ?)`,
      )
      .bind(id('event'), roomId, createdAt),
  );

  await db.batch(statements);

  return {
    room_slug: slug,
    participant_token: participantToken,
    participant: { id: liveParticipantId, display_name: 'You' },
  };
}

export async function authenticateRoom(
  slug: string,
  authorization: string | null,
): Promise<AuthContext> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 256) {
    throw new RoomError(401, 'UNAUTHORIZED', 'A valid room session is required.');
  }

  const db = getD1();
  const tokenHash = await hashToken(token);
  const row = await first<RoomRow & {
    participant_id: string;
    participant_room_id: string;
    display_name: string;
    actor_kind: 'live_human' | 'demo_agent';
    is_host: number;
    participant_status: string;
    joined_at: string;
  }>(
    db
      .prepare(
        `SELECT r.*, p.id AS participant_id, p.room_id AS participant_room_id,
                p.display_name, p.actor_kind, p.is_host,
                p.status AS participant_status, p.joined_at
         FROM rooms r
         JOIN participants p ON p.room_id = r.id
         WHERE r.slug = ? AND p.token_hash = ?
         LIMIT 1`,
      )
      .bind(slug, tokenHash),
  );

  if (!row) {
    throw new RoomError(401, 'UNAUTHORIZED', 'This room session is not valid.');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new RoomError(
      410,
      'ROOM_EXPIRED',
      'This demo room has expired. Start a fresh room to continue.',
      { roomVersion: row.version },
    );
  }

  return {
    room: row,
    participant: {
      id: row.participant_id,
      room_id: row.participant_room_id,
      display_name: row.display_name,
      actor_kind: row.actor_kind,
      is_host: row.is_host,
      status: row.participant_status,
      joined_at: row.joined_at,
    },
  };
}

function signalFingerprint(
  field: string,
  operator: string,
  value: string | number | boolean,
) {
  return `${field}:${operator}:${JSON.stringify(value).toLowerCase()}`;
}

function signalDisplay(
  field: CandidateField,
  operator: string,
  value: string | number | boolean,
) {
  const labels: Record<CandidateField, string> = {
    day: 'Day',
    start_time: 'Start',
    end_time: 'Finish',
    cost_per_person: 'Cost',
    travel_minutes: 'Travel',
    setting: 'Setting',
    accessibility: 'Access',
    format: 'Format',
  };
  const operatorLabels: Record<string, string> = {
    equals: 'must be',
    at_or_after: 'at or after',
    at_or_before: 'at or before',
    at_most: 'at most',
    requires: 'requires',
    prefers: 'prefers',
  };
  const formatted =
    field === 'cost_per_person'
      ? `$${value}`
      : field === 'travel_minutes'
        ? `${value} min`
        : String(value);
  return `${labels[field]} ${operatorLabels[operator] ?? operator} ${formatted}`;
}

function nextActions(phase: RoomPhase) {
  const byPhase: Record<RoomPhase, string[]> = {
    BRIEFING: ['begin_deliberation'],
    COLLECTING: ['get_room_state', 'submit_ballot'],
    BRIDGING: [
      'get_room_state',
      'submit_ballot',
      'publish_signal',
      'propose_bridge',
    ],
    READY_TO_NOMINATE: [
      'get_room_state',
      'submit_ballot',
      'nominate_candidate',
    ],
    RATIFYING: [
      'get_room_state',
      'human_ratification_required',
      'return_to_bridging',
    ],
    AGREED: ['get_agreement'],
  };
  return byPhase[phase];
}

function participantStatus(
  participant: ParticipantRow,
  room: RoomRow,
  ballots: BallotRow[],
  ratifications: RatificationRow[],
) {
  if (room.phase === 'AGREED') return 'Ratified';
  if (room.phase === 'RATIFYING') {
    return ratifications.some(
      (ratification) =>
        ratification.participant_id === participant.id &&
        ratification.decision === 'approve',
    )
      ? 'Ratified'
      : participant.actor_kind === 'live_human'
        ? 'Your approval is needed'
        : 'Reviewing';
  }
  if (room.phase === 'READY_TO_NOMINATE') return 'Common ground found';
  if (room.phase === 'BRIDGING') {
    const hasBridgeBallot = ballots.some(
      (ballot) => ballot.participant_id === participant.id,
    );
    return hasBridgeBallot ? 'Reviewing bridge' : 'Bridge vote needed';
  }
  if (room.phase === 'BRIEFING' && participant.actor_kind === 'live_human') {
    return 'Ready to enter';
  }
  return ballots.some((ballot) => ballot.participant_id === participant.id)
    ? 'Ballot submitted'
    : 'Ballot missing';
}

export async function getRoomState(context: AuthContext): Promise<RoomState> {
  const db = getD1();
  const freshRoom = await first<RoomRow>(
    db.prepare('SELECT * FROM rooms WHERE id = ?').bind(context.room.id),
  );
  if (!freshRoom) {
    throw new RoomError(404, 'ROOM_NOT_FOUND', 'This room no longer exists.');
  }

  const [participantRows, candidateRows, ballotRows, signalRows, eventRows, ratificationRows] =
    await Promise.all([
      all<ParticipantRow>(
        db
          .prepare(
            `SELECT id, room_id, display_name, actor_kind, is_host, status, joined_at
             FROM participants WHERE room_id = ? ORDER BY is_host DESC, joined_at ASC`,
          )
          .bind(freshRoom.id),
      ),
      all<CandidateRow>(
        db
          .prepare(
            `SELECT * FROM candidates
             WHERE room_id = ? AND is_active = 1
             ORDER BY created_at ASC`,
          )
          .bind(freshRoom.id),
      ),
      all<BallotRow>(
        db
          .prepare('SELECT * FROM ballots WHERE room_id = ?')
          .bind(freshRoom.id),
      ),
      all<SignalRow>(
        db
          .prepare(
            'SELECT * FROM coordination_signals WHERE room_id = ? ORDER BY created_at ASC',
          )
          .bind(freshRoom.id),
      ),
      all<PublicAuditEvent>(
        db
          .prepare(
            `SELECT id, actor_kind, actor_public_label, event_type,
                    public_summary, origin, created_at
             FROM audit_events WHERE room_id = ?
             ORDER BY created_at DESC LIMIT 12`,
          )
          .bind(freshRoom.id),
      ),
      all<RatificationRow>(
        db
          .prepare('SELECT * FROM ratifications WHERE room_id = ?')
          .bind(freshRoom.id),
      ),
    ]);

  const candidates = rankCandidates(
    candidateRows.map<PublicCandidate>((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      source_kind: candidate.source_kind,
      base_candidate_id: candidate.base_candidate_id,
      changes: parseJson<CandidateChange[]>(candidate.changes_json, []),
      change_count: candidate.change_count,
      is_locked: Boolean(candidate.is_locked),
      created_at: candidate.created_at,
      ...attributesFromRow(candidate),
      aggregate: aggregateCandidate(
        candidate.id,
        ballotRows,
        participantRows.length,
      ),
    })),
  );

  const currentBallot = Object.fromEntries(
    ballotRows
      .filter((ballot) => ballot.participant_id === context.participant.id)
      .map((ballot) => [ballot.candidate_id, ballot.stance]),
  ) as Record<string, Stance>;

  const participants = participantRows.map<PublicParticipant>((participant) => {
    const isCurrent = participant.id === context.participant.id;
    return {
      id: participant.id,
      display_name: participant.display_name,
      actor_kind: participant.actor_kind,
      badge: isCurrent
        ? 'You'
        : participant.actor_kind === 'demo_agent'
          ? 'Demo agent'
          : 'Participant',
      status: participantStatus(
        participant,
        freshRoom,
        ballotRows,
        ratificationRows,
      ),
      is_current: isCurrent,
    };
  });

  const signalsByFingerprint = new Map<string, PublicSignal>();
  if (!['BRIEFING', 'COLLECTING'].includes(freshRoom.phase)) {
    for (const signal of signalRows) {
      const value = parseJson<string | number | boolean>(signal.value_json, '');
      const existing = signalsByFingerprint.get(signal.public_fingerprint);
      if (existing) {
        existing.count += 1;
      } else {
        signalsByFingerprint.set(signal.public_fingerprint, {
          field: signal.field,
          operator: signal.operator,
          value,
          count: 1,
          display: signalDisplay(signal.field, signal.operator, value),
        });
      }
    }
  }

  const counts = await Promise.all([
    first<CountRow>(
      db
        .prepare('SELECT COUNT(*) AS count FROM ballots WHERE room_id = ?')
        .bind(freshRoom.id),
    ),
    first<CountRow>(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM coordination_signals WHERE room_id = ?',
        )
        .bind(freshRoom.id),
    ),
    first<CountRow>(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM candidates
           WHERE room_id = ? AND source_kind = 'bridge'`,
        )
        .bind(freshRoom.id),
    ),
    first<CountRow>(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM audit_events
           WHERE room_id = ? AND origin IN ('webmcp', 'demo_fixture')`,
        )
        .bind(freshRoom.id),
    ),
    first<CountRow>(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM audit_events
           WHERE room_id = ? AND origin = 'human_ui'`,
        )
        .bind(freshRoom.id),
    ),
  ]);

  return {
    room: {
      slug: freshRoom.slug,
      title: freshRoom.title,
      decision_question: freshRoom.decision_question,
      phase: freshRoom.phase,
      version: freshRoom.version,
      expires_at: freshRoom.expires_at,
      nominated_candidate_id: freshRoom.nominated_candidate_id,
    },
    current_participant: {
      id: context.participant.id,
      display_name: context.participant.display_name,
      is_host: Boolean(context.participant.is_host),
      ballot: currentBallot,
    },
    participants,
    candidates,
    signals: Array.from(signalsByFingerprint.values()),
    audit_events: eventRows.reverse(),
    privacy: {
      raw_private_context_received: 0,
      individual_ballots: 'hidden from the shared room',
      structured_ballot_entries: counts[0]?.count ?? 0,
      structured_signals_shared: counts[1]?.count ?? 0,
      bridge_proposals: counts[2]?.count ?? 0,
      agent_actions: counts[3]?.count ?? 0,
      human_actions: counts[4]?.count ?? 0,
    },
    available_actions: nextActions(freshRoom.phase),
  };
}

export async function getAgreement(context: AuthContext) {
  const state = await getRoomState(context);
  if (state.room.phase !== 'AGREED' || !state.room.nominated_candidate_id) {
    throw new RoomError(
      409,
      'AGREEMENT_NOT_READY',
      'The room has not reached a final agreement yet.',
      { roomVersion: state.room.version },
    );
  }
  const candidate = state.candidates.find(
    (entry) => entry.id === state.room.nominated_candidate_id,
  );
  return {
    ...state,
    agreement: {
      candidate,
      reached_at:
        (
          await first<{ agreed_at: string | null }>(
            getD1()
              .prepare('SELECT agreed_at FROM rooms WHERE id = ?')
              .bind(context.room.id),
          )
        )?.agreed_at ?? null,
      statement: 'Agreement reached without saying everything.',
    },
  };
}

async function replayReceipt(
  context: AuthContext,
  requestId: string,
): Promise<ToolResult | null> {
  if (!requestId) return null;
  const receipt = await first<{ response_json: string }>(
    getD1()
      .prepare(
        `SELECT response_json FROM mutation_receipts
         WHERE request_id = ? AND room_id = ? AND participant_id = ?`,
      )
      .bind(requestId, context.room.id, context.participant.id),
  );
  return receipt ? parseJson<ToolResult>(receipt.response_json, null as never) : null;
}

async function storeReceipt(
  context: AuthContext,
  requestId: string,
  result: ToolResult,
) {
  if (!requestId) return;
  await getD1()
    .prepare(
      `INSERT OR REPLACE INTO mutation_receipts
        (request_id, room_id, participant_id, response_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      requestId,
      context.room.id,
      context.participant.id,
      JSON.stringify(result),
      nowIso(),
    )
    .run();
}

async function currentRoom(roomId: string) {
  return first<RoomRow>(
    getD1().prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId),
  );
}

function requireVersion(room: RoomRow, expected: number) {
  if (room.version !== expected) {
    throw new RoomError(
      409,
      'STALE_ROOM_VERSION',
      `The room changed before this action was applied. Call get_room_state, review version ${room.version}, and retry.`,
      { retryable: true, roomVersion: room.version },
    );
  }
}

function requirePhase(room: RoomRow, allowed: RoomPhase[]) {
  if (!allowed.includes(room.phase)) {
    throw new RoomError(
      409,
      'WRONG_PHASE',
      `This action is not available while the room is ${room.phase.toLowerCase()}.`,
      { roomVersion: room.version },
    );
  }
}

function mutationOriginLabel(origin: RequestOrigin) {
  return origin === 'webmcp' ? 'Your agent' : 'You';
}

function casRoom(
  db: D1Database,
  roomId: string,
  expectedVersion: number,
  requestId: string,
) {
  return db
    .prepare(
      `UPDATE rooms
       SET version = version + 1, last_mutation_id = ?
       WHERE id = ? AND version = ?`,
    )
    .bind(requestId, roomId, expectedVersion);
}

function mutationGateSql() {
  return `EXISTS (
    SELECT 1 FROM rooms
    WHERE id = ? AND version = ? AND last_mutation_id = ?
  )`;
}

async function assertCas(result: D1Result, roomId: string) {
  if ((result.meta.changes ?? 0) > 0) return;
  const room = await currentRoom(roomId);
  throw new RoomError(
    409,
    'STALE_ROOM_VERSION',
    `The room changed before this action was applied. Call get_room_state, review version ${room?.version ?? 0}, and retry.`,
    { retryable: true, roomVersion: room?.version ?? 0 },
  );
}

export async function beginDeliberation(
  context: AuthContext,
  roomVersion: number,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  requireVersion(room, roomVersion);
  requirePhase(room, ['BRIEFING']);

  const db = getD1();
  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const results = await db.batch([
    casRoom(db, room.id, room.version, mutationId),
    db
      .prepare(
        `UPDATE rooms SET phase = 'COLLECTING'
         WHERE id = ? AND version = ? AND last_mutation_id = ?`,
      )
      .bind(room.id, nextVersion, mutationId),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, origin, created_at)
         SELECT ?, ?, 'live_human', 'You', 'deliberation_started',
           'You entered the shared decision room.', 'human_ui', ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('event'),
        room.id,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  ]);
  await assertCas(results[0], room.id);

  const result: ToolResult = {
    ok: true,
    room_version: nextVersion,
    summary: 'The shared decision room is ready.',
    public_effect: 'The room is collecting structured ballots.',
    next_actions: nextActions('COLLECTING'),
  };
  await storeReceipt(context, requestId, result);
  return result;
}

export async function submitBallot(
  context: AuthContext,
  input: BallotInput,
  origin: RequestOrigin,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  requireVersion(room, input.room_version);
  requirePhase(room, ['COLLECTING', 'BRIDGING', 'READY_TO_NOMINATE']);

  const db = getD1();
  const activeCandidates = await all<CandidateRow>(
    db
      .prepare(
        'SELECT * FROM candidates WHERE room_id = ? AND is_active = 1',
      )
      .bind(room.id),
  );
  const byId = new Map(activeCandidates.map((candidate) => [candidate.id, candidate]));
  const unknown = input.evaluations.filter(
    (evaluation) => !byId.has(evaluation.candidate_id),
  );
  if (unknown.length) {
    throw new RoomError(
      422,
      'UNKNOWN_CANDIDATE',
      `Unknown or inactive candidate: ${unknown[0].candidate_id}.`,
      { roomVersion: room.version },
    );
  }

  if (room.phase === 'COLLECTING') {
    const originals = activeCandidates
      .filter((candidate) => candidate.source_kind === 'original')
      .map((candidate) => candidate.id);
    const submitted = new Set(input.evaluations.map((entry) => entry.candidate_id));
    if (originals.some((candidateId) => !submitted.has(candidateId))) {
      throw new RoomError(
        422,
        'INCOMPLETE_INITIAL_BALLOT',
        'The initial ballot must evaluate every original candidate.',
        { roomVersion: room.version },
      );
    }
  } else if (
    input.evaluations.some(
      (evaluation) => byId.get(evaluation.candidate_id)?.source_kind !== 'bridge',
    )
  ) {
    throw new RoomError(
      422,
      'BRIDGE_BALLOTS_ONLY',
      'During bridge mode, submit evaluations only for bridge candidates.',
      { roomVersion: room.version },
    );
  }

  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    casRoom(db, room.id, room.version, mutationId),
  ];
  for (const evaluation of input.evaluations) {
    statements.push(
      db
        .prepare(
          `INSERT INTO ballots
            (room_id, participant_id, candidate_id, stance, updated_at)
           SELECT ?, ?, ?, ?, ? WHERE ${mutationGateSql()}
           ON CONFLICT(room_id, participant_id, candidate_id)
           DO UPDATE SET stance = excluded.stance, updated_at = excluded.updated_at`,
        )
        .bind(
          room.id,
          context.participant.id,
          evaluation.candidate_id,
          evaluation.stance,
          timestamp,
          room.id,
          nextVersion,
          mutationId,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE participants SET status = 'ballot_submitted'
         WHERE id = ? AND room_id = ? AND ${mutationGateSql()}`,
      )
      .bind(
        context.participant.id,
        room.id,
        room.id,
        nextVersion,
        mutationId,
      ),
    db
      .prepare(
        `UPDATE rooms
         SET phase = CASE
           WHEN EXISTS (
             SELECT 1 FROM candidates c
             LEFT JOIN ballots b
               ON b.room_id = c.room_id AND b.candidate_id = c.id
             WHERE c.room_id = rooms.id AND c.is_active = 1
             GROUP BY c.id
             HAVING COUNT(DISTINCT b.participant_id) =
               (SELECT COUNT(*) FROM participants p WHERE p.room_id = rooms.id)
               AND SUM(CASE WHEN b.stance = 'unacceptable' THEN 1 ELSE 0 END) = 0
           ) THEN 'READY_TO_NOMINATE'
           WHEN (
             SELECT COUNT(*) FROM ballots b
             JOIN candidates c ON c.room_id = b.room_id AND c.id = b.candidate_id
             WHERE b.room_id = rooms.id AND b.participant_id = ?
               AND c.source_kind = 'original'
           ) = (
             SELECT COUNT(*) FROM candidates c
             WHERE c.room_id = rooms.id AND c.source_kind = 'original' AND c.is_active = 1
           ) THEN 'BRIDGING'
           ELSE phase
         END
         WHERE id = ? AND version = ? AND last_mutation_id = ?
           AND phase IN ('COLLECTING', 'BRIDGING', 'READY_TO_NOMINATE')`,
      )
      .bind(
        context.participant.id,
        room.id,
        nextVersion,
        mutationId,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, origin, created_at)
         SELECT ?, ?, 'live_human', ?, 'ballot_submitted', ?, ?, ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('event'),
        room.id,
        mutationOriginLabel(origin),
        `${mutationOriginLabel(origin)} submitted a structured ballot.`,
        origin,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  );

  const results = await db.batch(statements);
  await assertCas(results[0], room.id);
  const state = await getRoomState(context);
  const publicEffect =
    room.phase !== state.room.phase
      ? state.room.phase === 'BRIDGING'
        ? 'No original option works for everyone. Bridge tools are now available.'
        : 'A candidate is acceptable to everyone and can be nominated.'
      : 'Aggregate support was updated in the shared room.';
  const result: ToolResult = {
    ok: true,
    room_version: state.room.version,
    summary: `Your ballot was recorded for ${input.evaluations.length} candidate${input.evaluations.length === 1 ? '' : 's'}.`,
    public_effect: publicEffect,
    privacy: 'No reason or raw private context was sent.',
    next_actions: state.available_actions,
  };
  await storeReceipt(context, requestId, result);
  return result;
}

function validateSignal(input: SignalInput, roomVersion: number) {
  const valid =
    (input.field === 'day' &&
      input.operator === 'equals' &&
      typeof input.value === 'string') ||
    (input.field === 'start_time' &&
      input.operator === 'at_or_after' &&
      typeof input.value === 'string') ||
    (input.field === 'end_time' &&
      input.operator === 'at_or_before' &&
      typeof input.value === 'string') ||
    ((input.field === 'cost_per_person' || input.field === 'travel_minutes') &&
      input.operator === 'at_most' &&
      typeof input.value === 'number') ||
    ((input.field === 'accessibility' || input.field === 'format') &&
      input.operator === 'requires' &&
      typeof input.value === 'string') ||
    (input.field === 'setting' &&
      ['equals', 'prefers'].includes(input.operator) &&
      typeof input.value === 'string');
  if (!valid) {
    throw new RoomError(
      422,
      'INVALID_SIGNAL',
      'That field, operator, and value combination is not valid.',
      { roomVersion },
    );
  }
}

export async function publishSignal(
  context: AuthContext,
  input: SignalInput,
  origin: RequestOrigin,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  requirePhase(room, ['BRIDGING']);
  validateSignal(input, room.version);

  const db = getD1();
  const fingerprint = signalFingerprint(input.field, input.operator, input.value);
  const duplicate = await first<{ id: string }>(
    db
      .prepare(
        `SELECT id FROM coordination_signals
         WHERE room_id = ? AND participant_id = ? AND public_fingerprint = ?
         LIMIT 1`,
      )
      .bind(room.id, context.participant.id, fingerprint),
  );
  if (duplicate && input.room_version <= room.version) {
    const result: ToolResult = {
      ok: true,
      room_version: room.version,
      summary: 'That structured signal is already represented in the room.',
      public_effect: 'Identical public signals remain collapsed into one card.',
      privacy: 'The signal source is hidden, but may be inferable in a small group.',
      next_actions: nextActions(room.phase),
    };
    await storeReceipt(context, requestId, result);
    return result;
  }
  requireVersion(room, input.room_version);

  const count = await first<CountRow>(
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM coordination_signals WHERE room_id = ? AND participant_id = ?',
      )
      .bind(room.id, context.participant.id),
  );
  if ((count?.count ?? 0) >= 8) {
    throw new RoomError(
      422,
      'SIGNAL_LIMIT',
      'A participant may publish at most eight active signals.',
      { roomVersion: room.version },
    );
  }

  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const results = await db.batch([
    casRoom(db, room.id, room.version, mutationId),
    db
      .prepare(
        `INSERT INTO coordination_signals
          (id, room_id, participant_id, field, operator, value_json,
           public_fingerprint, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('signal'),
        room.id,
        context.participant.id,
        input.field,
        input.operator,
        JSON.stringify(input.value),
        fingerprint,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, origin, created_at)
         SELECT ?, ?, 'live_human', ?, 'signal_published',
           'A source-hidden structured signal was published.', ?, ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('event'),
        room.id,
        mutationOriginLabel(origin),
        origin,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  ]);
  await assertCas(results[0], room.id);

  const result: ToolResult = {
    ok: true,
    room_version: nextVersion,
    summary: 'Your structured signal was accepted.',
    public_effect: `${signalDisplay(input.field, input.operator, input.value)} is now represented in the shared signals.`,
    privacy: 'The signal source is hidden, but may be inferable in a small group.',
    next_actions: nextActions('BRIDGING'),
  };
  await storeReceipt(context, requestId, result);
  return result;
}

const DAY_VALUES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const SETTING_VALUES = ['Indoor', 'Outdoor', 'Mixed'];
const ACCESS_VALUES = ['Step-free', 'Rugged terrain'];
const FORMAT_VALUES = [
  'Guided activity',
  'Collaborative workshop',
  'Collaborative retreat',
  'Self-directed challenge',
];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function assertSafeString(value: unknown, roomVersion: number) {
  if (typeof value !== 'string' || /[<>]/.test(value)) {
    throw new RoomError(
      422,
      'INVALID_BRIDGE_VALUE',
      'Bridge values must be plain structured values without markup.',
      { roomVersion },
    );
  }
}

function applyBridgeChanges(
  base: CandidateAttributes,
  input: BridgeInput,
  roomVersion: number,
) {
  const candidate: CandidateAttributes = { ...base };
  const publicChanges: CandidateChange[] = [];

  for (const change of input.changes) {
    const previous = candidate[change.field];
    if (typeof change.value === 'string') assertSafeString(change.value, roomVersion);
    if (String(previous) === String(change.value)) {
      throw new RoomError(
        422,
        'UNCHANGED_BRIDGE_FIELD',
        `The ${change.field} field has the same value as the base candidate.`,
        { roomVersion },
      );
    }

    switch (change.field) {
      case 'day':
        assertSafeString(change.value, roomVersion);
        if (!DAY_VALUES.includes(change.value as string)) {
          throw new RoomError(422, 'INVALID_DAY', 'Choose a valid day name.', {
            roomVersion,
          });
        }
        candidate.day = change.value as string;
        break;
      case 'start_time':
      case 'end_time':
        if (!validTime(change.value)) {
          throw new RoomError(
            422,
            'INVALID_TIME',
            'Times must use 24-hour HH:MM format.',
            { roomVersion },
          );
        }
        candidate[change.field] = change.value;
        break;
      case 'cost_per_person':
        if (
          typeof change.value !== 'number' ||
          !Number.isInteger(change.value) ||
          change.value < 0 ||
          change.value > 2000
        ) {
          throw new RoomError(
            422,
            'INVALID_COST',
            'Cost must be a whole number from 0 to 2,000.',
            { roomVersion },
          );
        }
        candidate.cost_per_person = change.value;
        break;
      case 'travel_minutes':
        if (
          typeof change.value !== 'number' ||
          !Number.isInteger(change.value) ||
          change.value < 0 ||
          change.value > 600
        ) {
          throw new RoomError(
            422,
            'INVALID_TRAVEL',
            'Travel must be a whole number from 0 to 600 minutes.',
            { roomVersion },
          );
        }
        candidate.travel_minutes = change.value;
        break;
      case 'setting':
        assertSafeString(change.value, roomVersion);
        if (!SETTING_VALUES.includes(change.value as string)) {
          throw new RoomError(422, 'INVALID_SETTING', 'Choose a known setting.', {
            roomVersion,
          });
        }
        candidate.setting = change.value as string;
        break;
      case 'accessibility':
        assertSafeString(change.value, roomVersion);
        if (!ACCESS_VALUES.includes(change.value as string)) {
          throw new RoomError(
            422,
            'INVALID_ACCESSIBILITY',
            'Choose a known accessibility value.',
            { roomVersion },
          );
        }
        candidate.accessibility = change.value as string;
        break;
      case 'format':
        assertSafeString(change.value, roomVersion);
        if (!FORMAT_VALUES.includes(change.value as string)) {
          throw new RoomError(422, 'INVALID_FORMAT', 'Choose a known format.', {
            roomVersion,
          });
        }
        candidate.format = change.value as string;
        break;
    }

    publicChanges.push({
      field: change.field,
      from: previous,
      to: candidate[change.field],
    });
  }

  if (candidate.start_time >= candidate.end_time) {
    throw new RoomError(
      422,
      'INVALID_TIME_ORDER',
      'End time must be after start time.',
      { roomVersion },
    );
  }

  return { candidate, publicChanges };
}

export async function proposeBridge(
  context: AuthContext,
  input: BridgeInput,
  origin: RequestOrigin,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  requirePhase(room, ['BRIDGING']);

  const db = getD1();
  const base = await first<CandidateRow>(
    db
      .prepare(
        `SELECT * FROM candidates
         WHERE room_id = ? AND id = ? AND is_active = 1 LIMIT 1`,
      )
      .bind(room.id, input.base_candidate_id),
  );
  if (!base) {
    throw new RoomError(
      422,
      'UNKNOWN_BASE_CANDIDATE',
      'Choose an active candidate as the bridge starting point.',
      { roomVersion: room.version },
    );
  }

  const { candidate, publicChanges } = applyBridgeChanges(
    attributesFromRow(base),
    input,
    room.version,
  );
  const normalizedChanges = [...input.changes]
    .sort((left, right) => left.field.localeCompare(right.field))
    .map((change) => ({ field: change.field, value: change.value }));
  const fingerprint = `${base.id}:${JSON.stringify(normalizedChanges)}`;
  const existing = await first<{ id: string; title: string }>(
    db
      .prepare(
        `SELECT id, title FROM candidates
         WHERE room_id = ? AND proposal_fingerprint = ? LIMIT 1`,
      )
      .bind(room.id, fingerprint),
  );
  if (existing && input.room_version <= room.version) {
    const result: ToolResult = {
      ok: true,
      room_version: room.version,
      summary: 'That bridge proposal already exists.',
      public_effect: `${existing.title} remains active in the field.`,
      privacy: 'The proposal contains structured changes, not a private reason.',
      data: { candidate_id: existing.id },
      next_actions: nextActions(room.phase),
    };
    await storeReceipt(context, requestId, result);
    return result;
  }
  requireVersion(room, input.room_version);

  const bridgeId = `${base.id}-bridge-${stableHash(fingerprint)}`.slice(0, 80);
  const changedDay = publicChanges.find((change) => change.field === 'day')?.to;
  const title = changedDay
    ? `${base.title} · ${changedDay} Bridge`
    : `${base.title} · Bridge`;
  const demoParticipants = await all<ParticipantRow>(
    db
      .prepare(
        `SELECT id, room_id, display_name, actor_kind, is_host, status, joined_at
         FROM participants WHERE room_id = ? AND actor_kind = 'demo_agent'`,
      )
      .bind(room.id),
  );
  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    casRoom(db, room.id, room.version, mutationId),
    db
      .prepare(
        `INSERT INTO candidates
          (room_id, id, base_candidate_id, title, source_kind, day, start_time,
           end_time, cost_per_person, travel_minutes, setting, accessibility,
           format, proposed_by_participant_id, change_count, changes_json,
           proposal_fingerprint, is_active, is_locked, created_at)
         SELECT ?, ?, ?, ?, 'bridge', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        room.id,
        bridgeId,
        base.id,
        title,
        candidate.day,
        candidate.start_time,
        candidate.end_time,
        candidate.cost_per_person,
        candidate.travel_minutes,
        candidate.setting,
        candidate.accessibility,
        candidate.format,
        context.participant.id,
        publicChanges.length,
        JSON.stringify(publicChanges),
        fingerprint,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  ];

  for (const participant of demoParticipants) {
    const profile = DEMO_PROFILES.find(
      (entry) => entry.name === participant.display_name,
    );
    if (!profile) continue;
    statements.push(
      db
        .prepare(
          `INSERT INTO ballots
            (room_id, participant_id, candidate_id, stance, updated_at)
           SELECT ?, ?, ?, ?, ? WHERE ${mutationGateSql()}`,
        )
        .bind(
          room.id,
          participant.id,
          bridgeId,
          evaluateDemoCandidate(profile, candidate),
          timestamp,
          room.id,
          nextVersion,
          mutationId,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, payload_json, origin, created_at)
         SELECT ?, ?, 'live_human', ?, 'bridge_proposed', ?, ?, ?, ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('event'),
        room.id,
        mutationOriginLabel(origin),
        `${mutationOriginLabel(origin)} created a bridge from ${base.title}.`,
        JSON.stringify({ candidate_id: bridgeId, base_candidate_id: base.id }),
        origin,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  );

  const results = await db.batch(statements);
  await assertCas(results[0], room.id);
  const state = await getRoomState(context);
  const aggregate = state.candidates.find(
    (entry) => entry.id === bridgeId,
  )?.aggregate;
  const result: ToolResult = {
    ok: true,
    room_version: state.room.version,
    summary: `${title} was created with ${publicChanges.length} structured changes.`,
    public_effect: `The new bridge entered the field. ${aggregate?.preferred ?? 0} prefer and ${aggregate?.acceptable ?? 0} accept it; your evaluation is still needed.`,
    privacy: 'The proposal contains structured changes, not a private reason.',
    data: { candidate_id: bridgeId, aggregate },
    next_actions: state.available_actions,
  };
  await storeReceipt(context, requestId, result);
  return result;
}

export async function nominateCandidate(
  context: AuthContext,
  input: NominationInput,
  origin: RequestOrigin,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  const db = getD1();
  if (
    room.phase === 'RATIFYING' &&
    room.nominated_candidate_id === input.candidate_id &&
    input.room_version <= room.version
  ) {
    const candidate = await first<{ title: string }>(
      db
        .prepare(
          'SELECT title FROM candidates WHERE room_id = ? AND id = ? LIMIT 1',
        )
        .bind(room.id, input.candidate_id),
    );
    const result: ToolResult = {
      ok: true,
      room_version: room.version,
      summary: `${candidate?.title ?? 'That candidate'} is already nominated for ratification.`,
      public_effect:
        'Three demo agents ratified. Your visible human approval is still required.',
      privacy: 'Nomination does not record final human approval.',
      data: {
        candidate_id: input.candidate_id,
        awaiting_human_ratification: true,
      },
      next_actions: nextActions('RATIFYING'),
    };
    await storeReceipt(context, requestId, result);
    return result;
  }
  requireVersion(room, input.room_version);
  requirePhase(room, ['READY_TO_NOMINATE']);

  const [candidate, ballotsForCandidate, participantCount] = await Promise.all([
    first<CandidateRow>(
      db
        .prepare(
          `SELECT * FROM candidates
           WHERE room_id = ? AND id = ? AND is_active = 1 LIMIT 1`,
        )
        .bind(room.id, input.candidate_id),
    ),
    all<BallotRow>(
      db
        .prepare(
          'SELECT * FROM ballots WHERE room_id = ? AND candidate_id = ?',
        )
        .bind(room.id, input.candidate_id),
    ),
    first<CountRow>(
      db
        .prepare('SELECT COUNT(*) AS count FROM participants WHERE room_id = ?')
        .bind(room.id),
    ),
  ]);
  if (!candidate) {
    throw new RoomError(
      422,
      'UNKNOWN_CANDIDATE',
      'Choose an active candidate to nominate.',
      { roomVersion: room.version },
    );
  }
  const aggregate = aggregateCandidate(
    candidate.id,
    ballotsForCandidate,
    participantCount?.count ?? 0,
  );
  if (!aggregate.viable) {
    throw new RoomError(
      409,
      'CANDIDATE_NOT_VIABLE',
      'Every active participant must accept or prefer a candidate before nomination.',
      { roomVersion: room.version },
    );
  }

  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const results = await db.batch([
    casRoom(db, room.id, room.version, mutationId),
    db
      .prepare(
        `UPDATE rooms
         SET phase = 'RATIFYING', nominated_candidate_id = ?
         WHERE id = ? AND version = ? AND last_mutation_id = ?`,
      )
      .bind(candidate.id, room.id, nextVersion, mutationId),
    db
      .prepare(
        `UPDATE candidates SET is_locked = 1
         WHERE room_id = ? AND id = ? AND ${mutationGateSql()}`,
      )
      .bind(
        room.id,
        candidate.id,
        room.id,
        nextVersion,
        mutationId,
      ),
    db
      .prepare(
        `INSERT INTO ratifications
          (room_id, participant_id, candidate_id, decision, created_at)
         SELECT p.room_id, p.id, ?, 'approve', ?
         FROM participants p
         WHERE p.room_id = ? AND p.actor_kind = 'demo_agent'
           AND ${mutationGateSql()}
         ON CONFLICT(room_id, participant_id, candidate_id)
         DO UPDATE SET decision = 'approve', created_at = excluded.created_at`,
      )
      .bind(
        candidate.id,
        timestamp,
        room.id,
        room.id,
        nextVersion,
        mutationId,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, room_id, actor_kind, actor_public_label, event_type,
           public_summary, payload_json, origin, created_at)
         SELECT ?, ?, 'live_human', ?, 'candidate_nominated', ?, ?, ?, ?
         WHERE ${mutationGateSql()}`,
      )
      .bind(
        id('event'),
        room.id,
        mutationOriginLabel(origin),
        `${mutationOriginLabel(origin)} nominated ${candidate.title} for human ratification.`,
        JSON.stringify({ candidate_id: candidate.id }),
        origin,
        timestamp,
        room.id,
        nextVersion,
        mutationId,
      ),
  ]);
  await assertCas(results[0], room.id);

  const result: ToolResult = {
    ok: true,
    room_version: nextVersion,
    summary: `${candidate.title} was nominated for ratification.`,
    public_effect: 'Three demo agents ratified. Your visible human approval is still required.',
    privacy: 'Nomination does not record final human approval.',
    data: { candidate_id: candidate.id, awaiting_human_ratification: true },
    next_actions: nextActions('RATIFYING'),
  };
  await storeReceipt(context, requestId, result);
  return result;
}

export async function ratifyCandidate(
  context: AuthContext,
  input: RatificationInput,
  requestId: string,
) {
  const replay = await replayReceipt(context, requestId);
  if (replay) return replay;
  const room = await currentRoom(context.room.id);
  if (!room) throw new RoomError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  requireVersion(room, input.room_version);
  requirePhase(room, ['RATIFYING']);
  if (room.nominated_candidate_id !== input.candidate_id) {
    throw new RoomError(
      422,
      'CANDIDATE_NOT_NOMINATED',
      'Only the currently nominated candidate can be ratified.',
      { roomVersion: room.version },
    );
  }

  const db = getD1();
  const candidate = await first<{ title: string }>(
    db
      .prepare(
        'SELECT title FROM candidates WHERE room_id = ? AND id = ? LIMIT 1',
      )
      .bind(room.id, input.candidate_id),
  );
  const mutationId = requestId || id('request');
  const nextVersion = room.version + 1;
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    casRoom(db, room.id, room.version, mutationId),
  ];

  if (input.decision === 'decline') {
    statements.push(
      db
        .prepare(
          `UPDATE rooms
           SET phase = 'BRIDGING', nominated_candidate_id = NULL
           WHERE id = ? AND version = ? AND last_mutation_id = ?`,
        )
        .bind(room.id, nextVersion, mutationId),
      db
        .prepare(
          `UPDATE candidates SET is_locked = 0
           WHERE room_id = ? AND id = ? AND ${mutationGateSql()}`,
        )
        .bind(
          room.id,
          input.candidate_id,
          room.id,
          nextVersion,
          mutationId,
        ),
      db
        .prepare(
          `DELETE FROM ratifications
           WHERE room_id = ? AND candidate_id = ? AND ${mutationGateSql()}`,
        )
        .bind(
          room.id,
          input.candidate_id,
          room.id,
          nextVersion,
          mutationId,
        ),
      db
        .prepare(
          `INSERT INTO audit_events
            (id, room_id, actor_kind, actor_public_label, event_type,
             public_summary, origin, created_at)
           SELECT ?, ?, 'live_human', 'You', 'ratification_declined',
             'You returned the room to bridge building.', 'human_ui', ?
           WHERE ${mutationGateSql()}`,
        )
        .bind(
          id('event'),
          room.id,
          timestamp,
          room.id,
          nextVersion,
          mutationId,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO ratifications
            (room_id, participant_id, candidate_id, decision, created_at)
           SELECT ?, ?, ?, 'approve', ? WHERE ${mutationGateSql()}
           ON CONFLICT(room_id, participant_id, candidate_id)
           DO UPDATE SET decision = 'approve', created_at = excluded.created_at`,
        )
        .bind(
          room.id,
          context.participant.id,
          input.candidate_id,
          timestamp,
          room.id,
          nextVersion,
          mutationId,
        ),
      db
        .prepare(
          `UPDATE rooms
           SET phase = 'AGREED', agreed_at = ?
           WHERE id = ? AND version = ? AND last_mutation_id = ?`,
        )
        .bind(timestamp, room.id, nextVersion, mutationId),
      db
        .prepare(
          `INSERT INTO audit_events
            (id, room_id, actor_kind, actor_public_label, event_type,
             public_summary, origin, created_at)
           SELECT ?, ?, 'live_human', 'You', 'agreement_ratified', ?, 'human_ui', ?
           WHERE ${mutationGateSql()}`,
        )
        .bind(
          id('event'),
          room.id,
          `You personally ratified ${candidate?.title ?? 'the agreement'}.`,
          timestamp,
          room.id,
          nextVersion,
          mutationId,
        ),
    );
  }

  const results = await db.batch(statements);
  await assertCas(results[0], room.id);
  const nextPhase: RoomPhase = input.decision === 'approve' ? 'AGREED' : 'BRIDGING';
  const result: ToolResult = {
    ok: true,
    room_version: nextVersion,
    summary:
      input.decision === 'approve'
        ? 'Your human ratification completed the agreement.'
        : 'The room returned to bridge building.',
    public_effect:
      input.decision === 'approve'
        ? 'All four participants have ratified the agreement.'
        : 'The nominated candidate was unlocked for further work.',
    privacy: 'Ratification records a decision, not a private reason.',
    next_actions: nextActions(nextPhase),
  };
  await storeReceipt(context, requestId, result);
  return result;
}
