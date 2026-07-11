import { isFixtureDataMode } from '../../../../src/config/runtimeModes';
import {
  deterministicCuratedBtcOracleResponse,
  deterministicMultiDayCuratedBtcOracleResponse,
} from '../../../../src/server/deterministicPredictFixtures';
import {
  buildCuratedBtcOracleResponse,
  parseProductLineParam,
} from '../../../../src/server/curatedOracles';

export const dynamic = 'force-dynamic';

const BTC_ORACLES_CACHE_CONTROL = 's-maxage=15, stale-while-revalidate=30';

function jsonWithCache(payload: unknown) {
  return Response.json(payload, {
    headers: {
      'cache-control': BTC_ORACLES_CACHE_CONTROL,
    },
  });
}

export async function GET(request: Request) {
  const productLine = parseProductLineParam(new URL(request.url).searchParams.get('productLine'));

  if (isFixtureDataMode()) {
    return jsonWithCache(
      productLine === 'multi-day'
        ? deterministicMultiDayCuratedBtcOracleResponse()
        : deterministicCuratedBtcOracleResponse(),
    );
  }

  try {
    return jsonWithCache(await buildCuratedBtcOracleResponse(Date.now(), productLine));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Curated BTC oracle request failed.',
        generatedAt: Date.now(),
        dataSource: 'live',
        oracles: [],
      },
      { status: 502 },
    );
  }
}
