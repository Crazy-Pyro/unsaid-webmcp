import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

const bootstrapSql = `
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  decision_question TEXT NOT NULL,
  title TEXT NOT NULL,
  phase TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  last_mutation_id TEXT,
  nominated_candidate_id TEXT,
  demo_mode INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  agreed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS rooms_slug_idx ON rooms(slug);
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  token_hash TEXT,
  is_host INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'joined',
  joined_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS participants_room_idx ON participants(room_id);
CREATE TABLE IF NOT EXISTS candidates (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  base_candidate_id TEXT,
  title TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  cost_per_person INTEGER NOT NULL,
  travel_minutes INTEGER NOT NULL,
  setting TEXT NOT NULL,
  accessibility TEXT NOT NULL,
  format TEXT NOT NULL,
  proposed_by_participant_id TEXT,
  change_count INTEGER NOT NULL DEFAULT 0,
  changes_json TEXT NOT NULL DEFAULT '[]',
  proposal_fingerprint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(room_id, id)
);
CREATE INDEX IF NOT EXISTS candidates_room_idx ON candidates(room_id);
CREATE UNIQUE INDEX IF NOT EXISTS candidates_room_proposal_idx
  ON candidates(room_id, proposal_fingerprint);
CREATE TABLE IF NOT EXISTS ballots (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  stance TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(room_id, participant_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS ballots_room_candidate_idx
  ON ballots(room_id, candidate_id);
CREATE TABLE IF NOT EXISTS coordination_signals (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value_json TEXT NOT NULL,
  public_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS signals_room_idx ON coordination_signals(room_id);
CREATE INDEX IF NOT EXISTS signals_room_fingerprint_idx
  ON coordination_signals(room_id, public_fingerprint);
CREATE TABLE IF NOT EXISTS ratifications (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(room_id, participant_id, candidate_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_kind TEXT NOT NULL,
  actor_public_label TEXT,
  event_type TEXT NOT NULL,
  public_summary TEXT NOT NULL,
  payload_json TEXT,
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_room_time_idx
  ON audit_events(room_id, created_at);
CREATE TABLE IF NOT EXISTS mutation_receipts (
  request_id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS receipts_room_idx ON mutation_receipts(room_id);
`;

let schemaReady: Promise<void> | null = null;

export function getD1(): D1Database {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Configure the DB binding before using room data.',
    );
  }
  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export async function ensureSchema() {
  if (!schemaReady) {
    const database = getD1();
    const statements = bootstrapSql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));
    schemaReady = database
      .batch(statements)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
