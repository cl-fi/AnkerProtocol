import { fetchBinanceDualInvestmentProducts } from '../../../../src/deepbook/binanceDualInvestment';

export const dynamic = 'force-dynamic';

export async function GET() {
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
