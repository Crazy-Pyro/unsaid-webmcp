export type RoomPhase =
  | 'BRIEFING'
  | 'COLLECTING'
  | 'BRIDGING'
  | 'READY_TO_NOMINATE'
  | 'RATIFYING'
  | 'AGREED';

export type Stance = 'preferred' | 'acceptable' | 'unacceptable';

export type CandidateField =
  | 'day'
  | 'start_time'
  | 'end_time'
  | 'cost_per_person'
  | 'travel_minutes'
  | 'setting'
  | 'accessibility'
  | 'format';

export type CandidateAttributes = {
  day: string;
  start_time: string;
  end_time: string;
  cost_per_person: number;
  travel_minutes: number;
  setting: string;
  accessibility: string;
  format: string;
};

export type CandidateFixture = CandidateAttributes & {
  id: string;
  title: string;
};

export type CandidateChange = {
  field: CandidateField;
  from: string | number;
  to: string | number;
};

export type CandidateAggregate = {
  preferred: number;
  acceptable: number;
  unacceptable: number;
  missing: number;
  distance_to_consensus: number;
  viable: boolean;
};

export type PublicCandidate = CandidateAttributes & {
  id: string;
  title: string;
  source_kind: 'original' | 'bridge';
  base_candidate_id: string | null;
  changes: CandidateChange[];
  change_count: number;
  is_locked: boolean;
  created_at: string;
  aggregate: CandidateAggregate;
};

export type PublicParticipant = {
  id: string;
  display_name: string;
  actor_kind: 'live_human' | 'demo_agent';
  badge: 'You' | 'Demo agent' | 'Participant';
  status: string;
  is_current: boolean;
};

export type PublicSignal = {
  field: CandidateField;
  operator: string;
  value: string | number | boolean;
  count: number;
  display: string;
};

export type PublicAuditEvent = {
  id: string;
  actor_kind: string;
  actor_public_label: string | null;
  event_type: string;
  public_summary: string;
  origin: 'human_ui' | 'webmcp' | 'demo_fixture' | 'system';
  created_at: string;
};

export type PrivacyAccounting = {
  raw_private_context_received: 0;
  individual_ballots: 'hidden from the shared room';
  structured_ballot_entries: number;
  structured_signals_shared: number;
  bridge_proposals: number;
  agent_actions: number;
  human_actions: number;
};

export type RoomState = {
  room: {
    slug: string;
    title: string;
    decision_question: string;
    phase: RoomPhase;
    version: number;
    expires_at: string;
    nominated_candidate_id: string | null;
  };
  current_participant: {
    id: string;
    display_name: string;
    is_host: boolean;
    ballot: Record<string, Stance>;
  };
  participants: PublicParticipant[];
  candidates: PublicCandidate[];
  signals: PublicSignal[];
  audit_events: PublicAuditEvent[];
  privacy: PrivacyAccounting;
  available_actions: string[];
};

export type ToolError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ToolResult<T = unknown> = {
  ok: boolean;
  room_version: number;
  summary: string;
  public_effect?: string;
  privacy?: string;
  data?: T;
  next_actions?: string[];
  error?: ToolError;
};
