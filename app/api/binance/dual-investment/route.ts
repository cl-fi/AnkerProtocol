import { areExperimentalProductsEnabled, EXPERIMENTAL_PRODUCTS_ERROR } from '../../../../src/config/experimentalFeatures';
import { fetchBinanceDualInvestmentProducts } from '../../../../src/deepbook/binanceDualInvestment';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!areExperimentalProductsEnabled()) {
    return Response.json({ error: EXPERIMENTAL_PRODUCTS_ERROR }, { status: 404 });
  }

  try {
    return Response.json(await fetchBinanceDualInvestmentProducts());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Binance Dual Investment proxy failed.',
      },
      { status: 502 },
    );
  }
}
