import assert from 'node:assert/strict';

const baseUrl = process.env.UNSAID_BASE_URL ?? 'http://localhost:3000';

async function jsonRequest(
  path,
  { token, body, requestId, humanIntent, origin = baseUrl } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      accept: 'application/json',
      origin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(requestId ? { 'x-unsaid-request-id': requestId } : {}),
      ...(body === undefined ? {} : { 'x-unsaid-origin': 'webmcp' }),
      ...(humanIntent ? { 'x-unsaid-human-intent': 'ratify-click' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { raw: responseText };
  }
  return { response, payload };
}

function assertNoPrivateContext(payload) {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('I can attend Thursday'), false);
  assert.equal(serialized.includes('cannot spend more than'), false);
  assert.equal(serialized.includes('private_reason'), false);
}

const crossOrigin = await jsonRequest('/api/demo/rooms', {
  body: {},
  origin: 'https://example.invalid',
});
assert.equal(crossOrigin.response.status, 403);

const created = await jsonRequest('/api/demo/rooms', { body: {} });
assert.equal(created.response.status, 201);
const { room_slug: slug, participant_token: token } = created.payload;
assert.ok(slug && token);

const unauthorized = await jsonRequest(`/api/rooms/${slug}/state`);
assert.equal(unauthorized.response.status, 401);

let stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.response.status, 200);
assert.equal(stateResult.payload.room.phase, 'BRIEFING');
assert.equal(stateResult.payload.privacy.raw_private_context_received, 0);
assertNoPrivateContext(stateResult.payload);

const beginOptions = {
  token,
  body: { room_version: stateResult.payload.room.version },
  requestId: `flow-begin-${crypto.randomUUID()}`,
};
const begun = await jsonRequest(`/api/rooms/${slug}/begin`, beginOptions);
assert.equal(begun.response.status, 200);
assert.equal(begun.payload.room_version, 2);
const begunReplay = await jsonRequest(`/api/rooms/${slug}/begin`, beginOptions);
assert.deepEqual(begunReplay.payload, begun.payload);

const stale = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: 1,
    evaluations: [{ candidate_id: 'river-run', stance: 'unacceptable' }],
  },
  requestId: `flow-stale-${crypto.randomUUID()}`,
});
assert.equal(stale.response.status, 409);
assert.equal(stale.payload.error.code, 'STALE_ROOM_VERSION');

const incomplete = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: 2,
    evaluations: [{ candidate_id: 'museum-sprint', stance: 'preferred' }],
  },
  requestId: `flow-incomplete-${crypto.randomUUID()}`,
});
assert.equal(incomplete.response.status, 422);
assert.equal(incomplete.payload.error.code, 'INCOMPLETE_INITIAL_BALLOT');

const unknown = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: 2,
    evaluations: [
      { candidate_id: 'river-run', stance: 'unacceptable' },
      { candidate_id: 'city-studio', stance: 'unacceptable' },
      { candidate_id: 'mountain-lodge', stance: 'unacceptable' },
      { candidate_id: 'lakeside-lab', stance: 'unacceptable' },
      { candidate_id: 'museum-sprint', stance: 'preferred' },
      { candidate_id: 'unknown-option', stance: 'acceptable' },
    ],
  },
  requestId: `flow-unknown-${crypto.randomUUID()}`,
});
assert.equal(unknown.response.status, 422);
assert.equal(unknown.payload.error.code, 'UNKNOWN_CANDIDATE');

const ballot = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: 2,
    evaluations: [
      { candidate_id: 'river-run', stance: 'unacceptable' },
      { candidate_id: 'city-studio', stance: 'unacceptable' },
      { candidate_id: 'mountain-lodge', stance: 'unacceptable' },
      { candidate_id: 'lakeside-lab', stance: 'unacceptable' },
      { candidate_id: 'museum-sprint', stance: 'preferred' },
    ],
  },
  requestId: `flow-ballot-${crypto.randomUUID()}`,
});
assert.equal(ballot.response.status, 200);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'BRIDGING');
assert.equal(stateResult.payload.candidates.some((candidate) => candidate.aggregate.viable), false);
assert.equal(
  stateResult.payload.participants.some((participant) => 'ballot' in participant),
  false,
);
assertNoPrivateContext(stateResult.payload);

const invalidTime = await jsonRequest(`/api/rooms/${slug}/bridges`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    base_candidate_id: 'lakeside-lab',
    changes: [
      { field: 'start_time', value: '17:00' },
      { field: 'end_time', value: '16:00' },
    ],
  },
  requestId: `flow-invalid-time-${crypto.randomUUID()}`,
});
assert.equal(invalidTime.response.status, 422);
assert.equal(invalidTime.payload.error.code, 'INVALID_TIME_ORDER');

const invalidSetting = await jsonRequest(`/api/rooms/${slug}/bridges`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    base_candidate_id: 'lakeside-lab',
    changes: [{ field: 'setting', value: 'Secret bunker' }],
  },
  requestId: `flow-invalid-setting-${crypto.randomUUID()}`,
});
assert.equal(invalidSetting.response.status, 422);
assert.equal(invalidSetting.payload.error.code, 'INVALID_SETTING');

const invalidFormat = await jsonRequest(`/api/rooms/${slug}/bridges`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    base_candidate_id: 'lakeside-lab',
    changes: [{ field: 'format', value: 'Unstructured discussion' }],
  },
  requestId: `flow-invalid-format-${crypto.randomUUID()}`,
});
assert.equal(invalidFormat.response.status, 422);
assert.equal(invalidFormat.payload.error.code, 'INVALID_FORMAT');

const signalOptions = {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    field: 'end_time',
    operator: 'at_or_before',
    value: '17:00',
    visibility: 'source_hidden',
  },
  requestId: `flow-signal-${crypto.randomUUID()}`,
};
const signal = await jsonRequest(`/api/rooms/${slug}/signals`, signalOptions);
assert.equal(signal.response.status, 200);
const signalReplay = await jsonRequest(`/api/rooms/${slug}/signals`, signalOptions);
assert.deepEqual(signalReplay.payload, signal.payload);
const duplicateSignal = await jsonRequest(`/api/rooms/${slug}/signals`, {
  ...signalOptions,
  requestId: `flow-signal-duplicate-${crypto.randomUUID()}`,
});
assert.equal(duplicateSignal.response.status, 200);
assert.equal(duplicateSignal.payload.room_version, signal.payload.room_version);
assert.match(duplicateSignal.payload.summary, /already represented/i);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.privacy.structured_signals_shared, 8);
assert.equal(stateResult.payload.signals.length, 8);

const bridgeOptions = {
  token,
  body: {
    room_version: signal.payload.room_version,
    base_candidate_id: 'lakeside-lab',
    changes: [
      { field: 'day', value: 'Thursday' },
      { field: 'end_time', value: '16:00' },
      { field: 'cost_per_person', value: 235 },
    ],
  },
  requestId: `flow-bridge-${crypto.randomUUID()}`,
};
const bridge = await jsonRequest(`/api/rooms/${slug}/bridges`, bridgeOptions);
assert.equal(bridge.response.status, 200);
const bridgeId = bridge.payload.data.candidate_id;
const duplicateBridge = await jsonRequest(`/api/rooms/${slug}/bridges`, {
  ...bridgeOptions,
  requestId: `flow-bridge-duplicate-${crypto.randomUUID()}`,
});
assert.equal(duplicateBridge.response.status, 200);
assert.equal(duplicateBridge.payload.room_version, bridge.payload.room_version);
assert.equal(duplicateBridge.payload.data.candidate_id, bridgeId);
assert.match(duplicateBridge.payload.summary, /already exists/i);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
let bridgeCandidate = stateResult.payload.candidates.find(
  (candidate) => candidate.id === bridgeId,
);
assert.equal(
  stateResult.payload.candidates.filter(
    (candidate) => candidate.source_kind === 'bridge',
  ).length,
  1,
);
assert.equal(
  stateResult.payload.audit_events.filter(
    (event) => event.event_type === 'bridge_proposed',
  ).length,
  1,
);
assert.deepEqual(bridgeCandidate.aggregate, {
  preferred: 2,
  acceptable: 1,
  unacceptable: 0,
  missing: 1,
  distance_to_consensus: 1,
  viable: false,
});

const bridgeBallot = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    evaluations: [{ candidate_id: bridgeId, stance: 'preferred' }],
  },
  requestId: `flow-bridge-ballot-${crypto.randomUUID()}`,
});
assert.equal(bridgeBallot.response.status, 200);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'READY_TO_NOMINATE');
bridgeCandidate = stateResult.payload.candidates.find(
  (candidate) => candidate.id === bridgeId,
);
assert.equal(bridgeCandidate.aggregate.viable, true);
assert.equal(bridgeCandidate.aggregate.missing, 0);

const rejectedNomination = await jsonRequest(`/api/rooms/${slug}/nominations`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: 'museum-sprint',
  },
  requestId: `flow-bad-nomination-${crypto.randomUUID()}`,
});
assert.equal(rejectedNomination.response.status, 409);
assert.equal(rejectedNomination.payload.error.code, 'CANDIDATE_NOT_VIABLE');

const nominationOptions = {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: bridgeId,
  },
  requestId: `flow-nomination-${crypto.randomUUID()}`,
};
const nomination = await jsonRequest(
  `/api/rooms/${slug}/nominations`,
  nominationOptions,
);
assert.equal(nomination.response.status, 200);
const duplicateNomination = await jsonRequest(
  `/api/rooms/${slug}/nominations`,
  {
    ...nominationOptions,
    requestId: `flow-nomination-duplicate-${crypto.randomUUID()}`,
  },
);
assert.equal(duplicateNomination.response.status, 200);
assert.equal(
  duplicateNomination.payload.room_version,
  nomination.payload.room_version,
);
assert.match(duplicateNomination.payload.summary, /already nominated/i);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'RATIFYING');
bridgeCandidate = stateResult.payload.candidates.find(
  (candidate) => candidate.id === bridgeId,
);
assert.equal(bridgeCandidate.is_locked, true);
assert.equal(
  stateResult.payload.audit_events.filter(
    (event) => event.event_type === 'candidate_nominated',
  ).length,
  1,
);

const blockedRatification = await jsonRequest(`/api/rooms/${slug}/ratifications`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: bridgeId,
    decision: 'approve',
  },
  requestId: `flow-blocked-ratification-${crypto.randomUUID()}`,
});
assert.equal(blockedRatification.response.status, 403);
assert.equal(blockedRatification.payload.error.code, 'HUMAN_ACTION_REQUIRED');

const declined = await jsonRequest(`/api/rooms/${slug}/ratifications`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: bridgeId,
    decision: 'decline',
  },
  requestId: `flow-decline-${crypto.randomUUID()}`,
  humanIntent: true,
});
assert.equal(declined.response.status, 200);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'BRIDGING');
assert.equal(stateResult.payload.room.nominated_candidate_id, null);
bridgeCandidate = stateResult.payload.candidates.find(
  (candidate) => candidate.id === bridgeId,
);
assert.equal(bridgeCandidate.is_locked, false);

const reconsidered = await jsonRequest(`/api/rooms/${slug}/ballots`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    evaluations: [{ candidate_id: bridgeId, stance: 'preferred' }],
  },
  requestId: `flow-reconsidered-${crypto.randomUUID()}`,
});
assert.equal(reconsidered.response.status, 200);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'READY_TO_NOMINATE');
const renomination = await jsonRequest(`/api/rooms/${slug}/nominations`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: bridgeId,
  },
  requestId: `flow-renomination-${crypto.randomUUID()}`,
});
assert.equal(renomination.response.status, 200);

stateResult = await jsonRequest(`/api/rooms/${slug}/state`, { token });
assert.equal(stateResult.payload.room.phase, 'RATIFYING');

const ratification = await jsonRequest(`/api/rooms/${slug}/ratifications`, {
  token,
  body: {
    room_version: stateResult.payload.room.version,
    candidate_id: bridgeId,
    decision: 'approve',
  },
  requestId: `flow-ratification-${crypto.randomUUID()}`,
  humanIntent: true,
});
assert.equal(ratification.response.status, 200);

const agreement = await jsonRequest(`/api/rooms/${slug}/agreement`, { token });
assert.equal(agreement.response.status, 200);
assert.equal(agreement.payload.room.phase, 'AGREED');
assert.equal(agreement.payload.room.nominated_candidate_id, bridgeId);
assert.equal(agreement.payload.agreement.candidate.id, bridgeId);
assert.equal(agreement.payload.privacy.raw_private_context_received, 0);
assert.equal(agreement.payload.privacy.structured_signals_shared, 8);
assert.equal(agreement.payload.privacy.bridge_proposals, 1);
assert.equal(agreement.payload.audit_events.length, 12);
for (let index = 1; index < agreement.payload.audit_events.length; index += 1) {
  assert.ok(
    agreement.payload.audit_events[index - 1].created_at <=
      agreement.payload.audit_events[index].created_at,
  );
}
assertNoPrivateContext(agreement.payload);

console.log('UNSAID local API flow passed: BRIEFING → COLLECTING → BRIDGING → READY_TO_NOMINATE → RATIFYING → AGREED.');
