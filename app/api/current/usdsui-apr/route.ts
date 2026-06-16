import { buildCurrentAprResponse } from '../../../../src/server/currentAprResponse';

export const dynamic = 'force-dynamic';

export function GET() {
  return buildCurrentAprResponse();
}
