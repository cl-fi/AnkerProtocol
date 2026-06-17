import testnetDeployment from '../../contracts/anker_protocol/deployments/testnet.json';

export const ANKER_TESTNET_DEPLOYMENT = testnetDeployment;

export const ANKER_PROTOCOL = {
  packageId: process.env.NEXT_PUBLIC_ANKER_PACKAGE_ID ?? ANKER_TESTNET_DEPLOYMENT.packageId,
  registryId: process.env.NEXT_PUBLIC_ANKER_REGISTRY_ID ?? ANKER_TESTNET_DEPLOYMENT.registryId,
  adminCapId: process.env.NEXT_PUBLIC_ANKER_ADMIN_CAP_ID ?? ANKER_TESTNET_DEPLOYMENT.adminCapId,
  upgradeCapId: ANKER_TESTNET_DEPLOYMENT.upgradeCapId,
  publishDigest: ANKER_TESTNET_DEPLOYMENT.publishDigest,
} as const;
