import { areExperimentalProductsEnabled, EXPERIMENTAL_PRODUCTS_ERROR } from '../../../../src/config/experimentalFeatures';
import { buildCurrentAprResponse } from '../../../../src/server/currentAprResponse';

export const dynamic = 'force-dynamic';

export function GET() {
  if (!areExperimentalProductsEnabled()) {
    return Response.json({ error: EXPERIMENTAL_PRODUCTS_ERROR }, { status: 404 });
  }

  return buildCurrentAprResponse();
}
