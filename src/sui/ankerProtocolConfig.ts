import { ANKER_PROTOCOL } from '../config/anker';
import { DEEPBOOK_PREDICT, SUI_NETWORK } from '../config/deepbook';

export interface AnkerProtocolFeeds {
  pyth: string;
  blockScholesSpot: string;
  blockScholesForward: string;
  blockScholesSvi: string;
}

export interface AnkerProtocolConfig {
  network?: string;
  /** Latest published package id — the target for move calls; changes on every upgrade. */
  packageId: string;
  /**
   * Original (v1) package id — anchors on-chain type identity for structs and
   * events across upgrades; never changes. Use for type/event filters (ADR-0003).
   */
  originalPackageId: string;
  registryId: string;
  predictPackageId: string;
  /** 6-24 PoolVault shared object (replaces the 4-16 Predict object id). */
  poolVaultId: string;
  accountPackageId: string;
  accountRegistryId: string;
  accumulatorRoot: string;
  protocolConfigId: string;
  oracleRegistryId: string;
  feeds: AnkerProtocolFeeds;
  quoteAssetType: string;
  quoteAssetDecimals: number;
}

export const DEFAULT_ANKER_CONFIG: AnkerProtocolConfig = {
  network: SUI_NETWORK,
  packageId: ANKER_PROTOCOL.packageId,
  originalPackageId: ANKER_PROTOCOL.originalPackageId,
  registryId: ANKER_PROTOCOL.registryId,
  predictPackageId: DEEPBOOK_PREDICT.packageId,
  poolVaultId: DEEPBOOK_PREDICT.poolVaultId,
  accountPackageId: DEEPBOOK_PREDICT.accountPackageId,
  accountRegistryId: DEEPBOOK_PREDICT.accountRegistryId,
  accumulatorRoot: DEEPBOOK_PREDICT.accumulatorRoot,
  protocolConfigId: DEEPBOOK_PREDICT.protocolConfigId,
  oracleRegistryId: DEEPBOOK_PREDICT.oracleRegistryId,
  feeds: {
    pyth: DEEPBOOK_PREDICT.feeds.pyth,
    blockScholesSpot: DEEPBOOK_PREDICT.feeds.blockScholesSpot,
    blockScholesForward: DEEPBOOK_PREDICT.feeds.blockScholesForward,
    blockScholesSvi: DEEPBOOK_PREDICT.feeds.blockScholesSvi,
  },
  quoteAssetType: DEEPBOOK_PREDICT.quoteAssetType,
  quoteAssetDecimals: DEEPBOOK_PREDICT.quoteAssetDecimals,
};
