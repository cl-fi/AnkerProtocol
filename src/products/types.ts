export type ProductType = 'dual-investment';

export type PrincipalAsset = 'dUSDC' | 'DBTC' | 'USDsui';

export type LegInstrumentType = 'binary-up' | 'binary-down' | 'range';

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
  svi?: SviParameters;
  predictPricing?: PredictPricingState;
}

export interface SviParameters {
  a: number;
  b: number;
  rho: number;
  m: number;
  sigma: number;
}

export interface PredictPricingState {
  baseSpread: number;
  minSpread: number;
  utilizationMultiplier: number;
  minAskPrice: number;
  maxAskPrice: number;
  vaultBalance: number;
  vaultTotalMtm: number;
  vaultUtilization: number;
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
  apr?: number;
  realizedLegCount?: number;
  realizedLegIds: string[];
  expiredLegIds: string[];
}

export interface StructuredProductQuote {
  id: string;
  productType: ProductType;
  title: string;
  principal: number;
  principalAsset?: PrincipalAsset;
  quoteAsset?: 'dUSDC' | 'USDsui';
  oracle: OracleMarket;
  legs: LegQuote[];
  totalLegCost: number;
  reserve: number;
  coupon: number;
  targetPrice?: number;
  floorPrice?: number;
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
