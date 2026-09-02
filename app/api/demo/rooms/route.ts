import { createDemoRoom } from '@/src/server/room-repository';
import { assertSameOrigin, json, jsonError } from '@/src/server/http';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json(await createDemoRoom(), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
