import {
  ballotInputSchema,
  beginInputSchema,
  bridgeInputSchema,
  nominationInputSchema,
  ratificationInputSchema,
  signalInputSchema,
} from '@/src/shared/schemas';
import { assertSameOrigin, json, jsonError, readJson } from '@/src/server/http';
import {
  authenticateRoom,
  beginDeliberation,
  getAgreement,
  getRoomState,
  nominateCandidate,
  proposeBridge,
  publishSignal,
  ratifyCandidate,
  RoomError,
  submitBallot,
  type RequestOrigin,
} from '@/src/server/room-repository';

type RouteContext = {
  params: Promise<{ slug: string; action: string }>;
};

function requestOrigin(request: Request): RequestOrigin {
  return request.headers.get('x-unsaid-origin') === 'webmcp'
    ? 'webmcp'
    : 'human_ui';
}

function requestId(request: Request) {
  const value = request.headers.get('x-unsaid-request-id');
  return value && value.length <= 120 ? value : crypto.randomUUID();
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { slug, action } = await routeContext.params;
    const context = await authenticateRoom(
      slug,
      request.headers.get('authorization'),
    );
    if (action === 'state') return json(await getRoomState(context));
    if (action === 'agreement') return json(await getAgreement(context));
    throw new RoomError(404, 'ROUTE_NOT_FOUND', 'That room action does not exist.');
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertSameOrigin(request);
    const { slug, action } = await routeContext.params;
    const context = await authenticateRoom(
      slug,
      request.headers.get('authorization'),
    );
    const body = await readJson(request);
    const origin = requestOrigin(request);
    const mutationRequestId = requestId(request);

    switch (action) {
      case 'begin': {
        const input = beginInputSchema.parse(body);
        return json(
          await beginDeliberation(
            context,
            input.room_version,
            mutationRequestId,
          ),
        );
      }
      case 'ballots':
        return json(
          await submitBallot(
            context,
            ballotInputSchema.parse(body),
            origin,
            mutationRequestId,
          ),
        );
      case 'signals':
        return json(
          await publishSignal(
            context,
            signalInputSchema.parse(body),
            origin,
            mutationRequestId,
          ),
        );
      case 'bridges':
        return json(
          await proposeBridge(
            context,
            bridgeInputSchema.parse(body),
            origin,
            mutationRequestId,
          ),
        );
      case 'nominations':
        return json(
          await nominateCandidate(
            context,
            nominationInputSchema.parse(body),
            origin,
            mutationRequestId,
          ),
        );
      case 'ratifications': {
        if (request.headers.get('x-unsaid-human-intent') !== 'ratify-click') {
          throw new RoomError(
            403,
            'HUMAN_ACTION_REQUIRED',
            'Final ratification requires an explicit action in the visible human interface.',
            { roomVersion: context.room.version },
          );
        }
        return json(
          await ratifyCandidate(
            context,
            ratificationInputSchema.parse(body),
            mutationRequestId,
          ),
        );
      }
      default:
        throw new RoomError(
          404,
          'ROUTE_NOT_FOUND',
          'That room action does not exist.',
        );
    }
  } catch (error) {
    return jsonError(error);
  }
}
