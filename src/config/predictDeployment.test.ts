import { describe, expect, it } from 'vitest';
import deploymentFixture from './vendor/deepbook-predict/deployment.testnet.json';
import {
  ACCUMULATOR_ROOT,
  parsePredictDeployment,
  TURBO_CADENCE_NAME,
} from './predictDeployment';

describe('parsePredictDeployment', () => {
  it('parses vendored 6-24 deployment into runtime package and shared-object IDs', () => {
    const config = parsePredictDeployment(deploymentFixture);

    expect(config.network).toBe('testnet');
    expect(config.packages.predict).toBe(
      '0xdb3ef5a5129920e59c9b2ae25a77eddb48acd0e1c6307b97073f0e076016446e',
    );
    expect(config.packages.account).toBe(
      '0xb9389eac8d59170ffd1427c1a66e5c8306263464fcc6615e825c1f5b3e15da3b',
    );
    expect(config.packages.propbook).toBe(
      '0x8eb2adde1c91f8b7c9ba5e9b0a32bfb804510c342939c5f77458fd8143f9755b',
    );
    expect(config.packages.blockScholesOracle).toBe(
      '0x8192932b70d5946217d0f09aad44f84ad5c27ee4c1ca31b09f46200fbd31d3de',
    );
    expect(config.packages.fixedMath).toBe(
      '0x6930d8eff504f15e45e7ceec3d504bfc1a6f1e1d4c02babe03c156f77b84523d',
    );

    expect(config.sharedObjects.protocolConfig).toBe(
      '0x2325224629b4bd96d1f1d7ee937e07f8a06f861018a130bbb26db09cb0394cb6',
    );
    expect(config.sharedObjects.poolVault).toBe(
      '0xfde98c636eb8a7aba59c3a238cfee6b576b7118d1e5ffa2952876c4b270a3a2a',
    );
    expect(config.sharedObjects.predictRegistry).toBe(
      '0x54afbf245caf42466cedb5756ed7816f34f544afdfa13579a862eccf3afa21ca',
    );
    expect(config.sharedObjects.oracleRegistry).toBe(
      '0xf3deaff68cbd081a35ec21653af6f671d2ad5f012f3b4d817d81752843374136',
    );
    expect(config.sharedObjects.accountRegistry).toBe(
      '0x3c54d5b8b6bca376fc289121838ad02f8a5b3843242b9ad7e8f8245720e685a2',
    );

    expect(config.accumulatorRoot).toBe(ACCUMULATOR_ROOT);
    expect(config.quoteAssetType).toBe(
      '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
    );
    expect(config.quoteAssetDecimals).toBe(6);

    expect(config.feeds.pyth).toBe(
      '0xc78d7de16217d46d21b92ae475da799448be30b71a758dc6d7bb3ac2f1c35afb',
    );
    expect(config.feeds.blockScholesSpot).toBe(
      '0xcdc5fa7364e60fd2504aa96f65b707dc0734e507a919b1a7d7d63164fd67b745',
    );
    expect(config.feeds.blockScholesForward).toBe(
      '0xe72c734ea8d8dcbc9183d9d8f96f51aaa1fb5034d5ed33ac60d67d261e15b48a',
    );
    expect(config.feeds.blockScholesSvi).toBe(
      '0xdc2f8270676bd05fb28491e8d4a41a495722fda7a454926dd66dbba256a21c69',
    );

    expect(config.endpoints.predictServerUrl).toBe(
      'https://predict-server-beta.testnet.mystenlabs.com',
    );
    expect(config.endpoints.propbookServerUrl).toBe(
      'https://propbook.api.testnet.mystenlabs.com',
    );
    expect(config.endpoints.grpcUrl).toBe('https://fullnode.testnet.sui.io:443');
    expect(config.endpoints.graphqlUrl).toBe('https://graphql.testnet.sui.io/graphql');
  });

  it('exposes the Turbo 1h cadence fingerprint used to filter Expiry Markets', () => {
    const config = parsePredictDeployment(deploymentFixture);
    const turbo = config.cadences.find((cadence) => cadence.name === TURBO_CADENCE_NAME);

    expect(turbo).toEqual({
      id: 2,
      name: '1h',
      tickSize: '10000000',
      admissionTickSize: '1000000000',
      maxExpiryAllocation: '250000000000',
      initialExpiryCash: '50000000000',
      windowSize: '3',
    });
  });

  it('rejects deployment payloads missing required package IDs', () => {
    expect(() => parsePredictDeployment({ ...deploymentFixture, packages: {} })).toThrow(
      /packages\./,
    );
  });
});
