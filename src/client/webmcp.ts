'use client';

import { useEffect, useMemo, useRef } from 'react';

import { roomClient, readAgreement, readRoom } from '@/src/client/room-client';
import {
  ballotInputSchema,
  bridgeInputSchema,
  nominationInputSchema,
  signalInputSchema,
} from '@/src/shared/schemas';
import type { RoomState, ToolResult } from '@/src/shared/types';

type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(input: unknown): Record<string, unknown> | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        definition: ToolDefinition,
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}

type WebMCPOptions = {
  slug: string;
  state: RoomState;
  refresh: (signal?: AbortSignal) => Promise<RoomState>;
  onDetected: (detected: boolean) => void;
  onRegistered: (names: string[]) => void;
  onEffect: (effect: { tool: string; summary: string }) => void;
  onError: (message: string) => void;
};

const ballotSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    room_version: {
      type: 'integer',
      minimum: 0,
      description: 'Room version returned by get_room_state.',
    },
    evaluations: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          candidate_id: { type: 'string', minLength: 1, maxLength: 80 },
          stance: {
            type: 'string',
            enum: ['preferred', 'acceptable', 'unacceptable'],
          },
        },
        required: ['candidate_id', 'stance'],
      },
    },
  },
  required: ['room_version', 'evaluations'],
};

const signalSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    room_version: { type: 'integer', minimum: 0 },
    field: {
      type: 'string',
      enum: [
        'day',
        'start_time',
        'end_time',
        'cost_per_person',
        'travel_minutes',
        'setting',
        'accessibility',
        'format',
      ],
    },
    operator: {
      type: 'string',
      enum: [
        'equals',
        'at_or_after',
        'at_or_before',
        'at_most',
        'requires',
        'prefers',
      ],
    },
    value: {
      oneOf: [
        { type: 'string', maxLength: 60 },
        { type: 'number' },
        { type: 'boolean' },
      ],
    },
    visibility: { type: 'string', const: 'source_hidden' },
  },
  required: ['room_version', 'field', 'operator', 'value', 'visibility'],
};

const bridgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    room_version: { type: 'integer', minimum: 0 },
    base_candidate_id: { type: 'string', minLength: 1, maxLength: 80 },
    changes: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: {
            type: 'string',
            enum: [
              'day',
              'start_time',
              'end_time',
              'cost_per_person',
              'travel_minutes',
              'setting',
              'accessibility',
              'format',
            ],
          },
          value: {
            oneOf: [
              { type: 'string', maxLength: 80 },
              { type: 'number' },
              { type: 'boolean' },
            ],
          },
        },
        required: ['field', 'value'],
      },
    },
  },
  required: ['room_version', 'base_candidate_id', 'changes'],
};

const nominationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    room_version: { type: 'integer', minimum: 0 },
    candidate_id: { type: 'string', minLength: 1, maxLength: 80 },
  },
  required: ['room_version', 'candidate_id'],
};

function conciseState(state: RoomState) {
  return {
    phase: state.room.phase,
    room_version: state.room.version,
    decision: state.room.decision_question,
    current_participant: state.current_participant.display_name,
    candidates: state.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      day: candidate.day,
      time: `${candidate.start_time}-${candidate.end_time}`,
      cost_per_person: candidate.cost_per_person,
      travel_minutes: candidate.travel_minutes,
      setting: candidate.setting,
      accessibility: candidate.accessibility,
      format: candidate.format,
      aggregate: candidate.aggregate,
    })),
    public_signals: state.signals.map((signal) => signal.display),
    your_ballot: state.current_participant.ballot,
    available_actions: state.available_actions,
    privacy:
      'Raw private reasons are not requested or stored; other individual ballots are hidden.',
  };
}

async function afterPaint() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export function useWebMCPTools(options: WebMCPOptions) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  }, [options]);
  const phase = options.state.room.phase;

  const names = useMemo(() => {
    if (phase === 'AGREED') return ['get_agreement'];
    const result = ['get_room_state'];
    if (['COLLECTING', 'BRIDGING', 'READY_TO_NOMINATE'].includes(phase)) {
      result.push('submit_ballot');
    }
    if (phase === 'BRIDGING') result.push('publish_signal', 'propose_bridge');
    if (phase === 'READY_TO_NOMINATE') result.push('nominate_candidate');
    return result;
  }, [phase]);

  useEffect(() => {
    const forceManualFallback = new URLSearchParams(window.location.search).has(
      'manual-only',
    );
    const context = forceManualFallback ? undefined : document.modelContext;
    const detected = typeof context?.registerTool === 'function';
    latest.current.onDetected(detected);
    if (!detected || !context) {
      latest.current.onRegistered([]);
      return;
    }

    const controllers = new Map<string, AbortController>();
    const runWrite = async (
      tool: string,
      operation: () => Promise<ToolResult>,
    ) => {
      const result = await operation();
      await latest.current.refresh();
      latest.current.onEffect({
        tool,
        summary: result.public_effect ?? result.summary,
      });
      await afterPaint();
      return result;
    };

    const definitions: Record<string, () => ToolDefinition> = {
      get_room_state: () => ({
        name: 'get_room_state',
        title: 'Read decision room',
        description:
          'Read the current UNSAID room, active options, aggregate support, public signals, your status, and valid next actions. Use before evaluating options or after the room changes.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute() {
          const state = await readRoom(latest.current.slug);
          await latest.current.refresh();
          return conciseState(state);
        },
      }),
      submit_ballot: () => ({
        name: 'submit_ballot',
        title: 'Submit structured ballot',
        description:
          'Submit or revise your structured evaluations. This records only preferred, acceptable, or unacceptable for each candidate; it does not send a reason or private context.',
        inputSchema: ballotSchema,
        annotations: { readOnlyHint: false },
        execute(input) {
          const parsed = ballotInputSchema.parse(input);
          return runWrite(
            'submit_ballot',
            () =>
              roomClient.submitBallot(latest.current.slug, parsed, {
                origin: 'webmcp',
              }),
          );
        },
      }),
      publish_signal: () => ({
        name: 'publish_signal',
        title: 'Publish coordination signal',
        description:
          'Publish one structured attribute request without your name or reason. In a small group, others may still infer the source.',
        inputSchema: signalSchema,
        annotations: { readOnlyHint: false },
        execute(input) {
          const parsed = signalInputSchema.parse(input);
          return runWrite(
            'publish_signal',
            () =>
              roomClient.publishSignal(latest.current.slug, parsed, {
                origin: 'webmcp',
              }),
          );
        },
      }),
      propose_bridge: () => ({
        name: 'propose_bridge',
        title: 'Create bridge option',
        description:
          'Create a bridge option by changing structured attributes of an existing candidate. Use public signals plus private context without sending a private explanation.',
        inputSchema: bridgeSchema,
        annotations: { readOnlyHint: false },
        execute(input) {
          const parsed = bridgeInputSchema.parse(input);
          return runWrite(
            'propose_bridge',
            () =>
              roomClient.proposeBridge(latest.current.slug, parsed, {
                origin: 'webmcp',
              }),
          );
        },
      }),
      nominate_candidate: () => ({
        name: 'nominate_candidate',
        title: 'Nominate common ground',
        description:
          'Nominate a candidate everyone accepts. This opens human ratification and does not record final approval.',
        inputSchema: nominationSchema,
        annotations: { readOnlyHint: false },
        execute(input) {
          const parsed = nominationInputSchema.parse(input);
          return runWrite(
            'nominate_candidate',
            () =>
              roomClient.nominate(latest.current.slug, parsed, {
                origin: 'webmcp',
              }),
          );
        },
      }),
      get_agreement: () => ({
        name: 'get_agreement',
        title: 'Read agreement receipt',
        description:
          'Read the completed agreement, final candidate, public action ledger, and minimum-disclosure accounting after every participant ratifies.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute() {
          const agreement = await readAgreement(latest.current.slug);
          return {
            phase: agreement.room.phase,
            room_version: agreement.room.version,
            final_candidate: agreement.candidates.find(
              (candidate) => candidate.id === agreement.room.nominated_candidate_id,
            ),
            privacy: agreement.privacy,
            public_audit: agreement.audit_events,
          };
        },
      }),
    };

    for (const name of names) {
      const controller = new AbortController();
      controllers.set(name, controller);
      const definition = definitions[name]();
      try {
        void Promise.resolve(
          document.modelContext?.registerTool(definition, {
            signal: controller.signal,
          }),
        ).catch((error) => {
          latest.current.onError(
            error instanceof Error ? error.message : `Could not register ${name}.`,
          );
        });
      } catch (error) {
        latest.current.onError(
          error instanceof Error ? error.message : `Could not register ${name}.`,
        );
      }
    }
    latest.current.onRegistered(names);

    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, [names]);
}
