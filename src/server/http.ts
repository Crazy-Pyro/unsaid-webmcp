import { ZodError } from 'zod';

import { RoomError } from '@/src/server/room-repository';

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jsonError(error: unknown) {
  if (error instanceof RoomError) {
    return json(
      {
        ok: false,
        room_version: error.roomVersion,
        summary: error.message,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        issues: error.issues,
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) =>
      `${issue.path.join('.') || 'input'}: ${issue.message}`,
    );
    return json(
      {
        ok: false,
        room_version: 0,
        summary: 'The structured input was invalid.',
        error: {
          code: 'INVALID_INPUT',
          message: issues[0] ?? 'The structured input was invalid.',
          retryable: false,
        },
        issues,
      },
      { status: 422 },
    );
  }

  console.error('UNSAID request failed', error instanceof Error ? error.message : 'unknown');
  return json(
    {
      ok: false,
      room_version: 0,
      summary: 'The room could not complete that request.',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The room could not complete that request.',
        retryable: true,
      },
    },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new RoomError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new RoomError(
      403,
      'CROSS_ORIGIN_REQUEST',
      'Room mutations must originate from this site.',
    );
  }
}
