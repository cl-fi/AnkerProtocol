export type ProductType = 'dual-investment' | 'shark-fin';

export type PrincipalAsset = 'dUSDC' | 'DBTC';

export type LegInstrumentType = 'binary-up' | 'range';

export interface OracleMarket {
  predictId: string;
  oracleId: string;
  underlyingAsset: 'BTC';
  expiryMs: number;
  minStrike: number;
  tickSize: number;
  status: 'created' | 'active' | 'settled' | string;
  spot: number;
  forward: number;
  spotTimestampMs: number;
  sviTimestampMs: number;
  serverLagSeconds: number;
}

export interface LegIntent {
  id: string;
  instrumentType: LegInstrumentType;
  oracleId: string;
  expiryMs: number;
  strike?: number;
  lowerStrike?: number;
  higherStrike?: number;
  isUp?: boolean;
  quantity: number;
  description: string;
}

export interface LegQuote extends LegIntent {
  askPrice: number;
  askCost: number;
  redeemPreview: number;
  quoteTimestampMs: number;
  executable: boolean;
  error?: string;
}

export interface ScenarioOutcome {
  settlementPrice: number;
  label: string;
  finalUsdc: number;
  btcEquivalent?: number;
  coupon: number;
  realizedLegIds: string[];
  expiredLegIds: string[];
}

export interface StructuredProductQuote {
  id: string;
  productType: ProductType;
  title: string;
  principal: number;
  principalAsset?: PrincipalAsset;
  quoteAsset?: 'dUSDC';
  oracle: OracleMarket;
  legs: LegQuote[];
  totalLegCost: number;
  reserve: number;
  coupon: number;
  apr: number;
  executable: boolean;
  warning?: string;
  scenarios: ScenarioOutcome[];
}

export interface DualInvestmentInput {
  principal: number;
  targetPrice: number;
  floorPrice: number;
  stepSize?: number;
  targetLegCount?: number;
}

export interface SharkFinInput {
  principal: number;
  lowerBound: number;
  upperBound: number;
  stepSize: number;
  baseApr: number;
}
