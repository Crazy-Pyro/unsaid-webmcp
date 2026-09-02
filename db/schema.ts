import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    decisionQuestion: text('decision_question').notNull(),
    title: text('title').notNull(),
    phase: text('phase').notNull(),
    version: integer('version').notNull().default(1),
    lastMutationId: text('last_mutation_id'),
    nominatedCandidateId: text('nominated_candidate_id'),
    demoMode: integer('demo_mode').notNull().default(1),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    agreedAt: text('agreed_at'),
  },
  (table) => [uniqueIndex('rooms_slug_idx').on(table.slug)],
);

export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    actorKind: text('actor_kind').notNull(),
    tokenHash: text('token_hash'),
    isHost: integer('is_host').notNull().default(0),
    status: text('status').notNull().default('joined'),
    joinedAt: text('joined_at').notNull(),
    lastSeenAt: text('last_seen_at'),
  },
  (table) => [index('participants_room_idx').on(table.roomId)],
);

export const candidates = sqliteTable(
  'candidates',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    baseCandidateId: text('base_candidate_id'),
    title: text('title').notNull(),
    sourceKind: text('source_kind').notNull(),
    day: text('day').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    costPerPerson: integer('cost_per_person').notNull(),
    travelMinutes: integer('travel_minutes').notNull(),
    setting: text('setting').notNull(),
    accessibility: text('accessibility').notNull(),
    format: text('format').notNull(),
    proposedByParticipantId: text('proposed_by_participant_id'),
    changeCount: integer('change_count').notNull().default(0),
    changesJson: text('changes_json').notNull().default('[]'),
    proposalFingerprint: text('proposal_fingerprint'),
    isActive: integer('is_active').notNull().default(1),
    isLocked: integer('is_locked').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.id] }),
    index('candidates_room_idx').on(table.roomId),
    uniqueIndex('candidates_room_proposal_idx').on(
      table.roomId,
      table.proposalFingerprint,
    ),
  ],
);

export const ballots = sqliteTable(
  'ballots',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id').notNull(),
    stance: text('stance').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomId, table.participantId, table.candidateId],
    }),
    index('ballots_room_candidate_idx').on(table.roomId, table.candidateId),
  ],
);

export const coordinationSignals = sqliteTable(
  'coordination_signals',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    operator: text('operator').notNull(),
    valueJson: text('value_json').notNull(),
    publicFingerprint: text('public_fingerprint').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('signals_room_idx').on(table.roomId),
    index('signals_room_fingerprint_idx').on(
      table.roomId,
      table.publicFingerprint,
    ),
  ],
);

export const ratifications = sqliteTable(
  'ratifications',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id').notNull(),
    decision: text('decision').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomId, table.participantId, table.candidateId],
    }),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    actorKind: text('actor_kind').notNull(),
    actorPublicLabel: text('actor_public_label'),
    eventType: text('event_type').notNull(),
    publicSummary: text('public_summary').notNull(),
    payloadJson: text('payload_json'),
    origin: text('origin').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_room_time_idx').on(table.roomId, table.createdAt)],
);

export const mutationReceipts = sqliteTable(
  'mutation_receipts',
  {
    requestId: text('request_id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    responseJson: text('response_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('receipts_room_idx').on(table.roomId)],
);
