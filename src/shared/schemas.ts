import { z } from 'zod';

export const stanceSchema = z.enum([
  'preferred',
  'acceptable',
  'unacceptable',
]);

export const candidateFieldSchema = z.enum([
  'day',
  'start_time',
  'end_time',
  'cost_per_person',
  'travel_minutes',
  'setting',
  'accessibility',
  'format',
]);

export const ballotInputSchema = z
  .object({
    room_version: z.number().int().min(0),
    evaluations: z
      .array(
        z
          .object({
            candidate_id: z.string().min(1).max(80),
            stance: stanceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.evaluations.map((evaluation) => evaluation.candidate_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each candidate may appear only once.',
        path: ['evaluations'],
      });
    }
  });

const signalValueSchema = z.union([
  z.string().max(60),
  z.number(),
  z.boolean(),
]);

export const signalInputSchema = z
  .object({
    room_version: z.number().int().min(0),
    field: candidateFieldSchema,
    operator: z.enum([
      'equals',
      'at_or_after',
      'at_or_before',
      'at_most',
      'requires',
      'prefers',
    ]),
    value: signalValueSchema,
    visibility: z.literal('source_hidden'),
  })
  .strict();

export const bridgeInputSchema = z
  .object({
    room_version: z.number().int().min(0),
    base_candidate_id: z.string().min(1).max(80),
    changes: z
      .array(
        z
          .object({
            field: candidateFieldSchema,
            value: z.union([z.string().max(80), z.number(), z.boolean()]),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .superRefine((value, context) => {
    const fields = value.changes.map((change) => change.field);
    if (new Set(fields).size !== fields.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each field may be changed only once.',
        path: ['changes'],
      });
    }
  });

export const nominationInputSchema = z
  .object({
    room_version: z.number().int().min(0),
    candidate_id: z.string().min(1).max(80),
  })
  .strict();

export const beginInputSchema = z
  .object({ room_version: z.number().int().min(0) })
  .strict();

export const ratificationInputSchema = z
  .object({
    room_version: z.number().int().min(0),
    candidate_id: z.string().min(1).max(80),
    decision: z.enum(['approve', 'decline']),
  })
  .strict();

export type BallotInput = z.infer<typeof ballotInputSchema>;
export type SignalInput = z.infer<typeof signalInputSchema>;
export type BridgeInput = z.infer<typeof bridgeInputSchema>;
export type NominationInput = z.infer<typeof nominationInputSchema>;
export type RatificationInput = z.infer<typeof ratificationInputSchema>;
