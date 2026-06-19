import { isDeterministicE2E } from '../../../../src/config/runtimeModes';
import { deterministicCuratedBtcOracleResponse } from '../../../../src/server/deterministicPredictFixtures';
import { buildCuratedBtcOracleResponse } from '../../../../src/server/curatedOracles';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (isDeterministicE2E()) {
    return Response.json(deterministicCuratedBtcOracleResponse());
  }

  try {
    return Response.json(await buildCuratedBtcOracleResponse());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Curated BTC oracle request failed.',
        generatedAt: Date.now(),
        oracles: [],
      },
      { status: 502 },
    );
  }
}
