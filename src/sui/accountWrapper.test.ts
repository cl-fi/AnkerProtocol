import { describe, expect, it, vi } from 'vitest';
import {
  accountWrapperType,
  coinKeyType,
  deriveAccountWrapperAddress,
  fetchAccountWrapper,
  parseAccountWrapperBalance,
  parseAccountWrapperObject,
} from './accountWrapper';

const ACCOUNT_PACKAGE_ID = '0xb9389eac8d59170ffd1427c1a66e5c8306263464fcc6615e825c1f5b3e15da3b';
const ACCOUNT_REGISTRY_ID = '0x3c54d5b8b6bca376fc289121838ad02f8a5b3843242b9ad7e8f8245720e685a2';
const DEPLOYER = '0x364c09b14bc64320dd8ced0848e7e4efe75510bd7ee05a88253a5330b6f22bef';
const KNOWN_WRAPPER = '0x747fbd571a6cdaece5ae28843a1868d9ee4629e23c36166c38cc778c195cbd9d';
const DUSDC = '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

describe('accountWrapper discovery', () => {
  it('derives the deterministic AccountWrapper address for a known owner', () => {
    expect(
      deriveAccountWrapperAddress({
        accountPackageId: ACCOUNT_PACKAGE_ID,
        accountRegistryId: ACCOUNT_REGISTRY_ID,
        owner: DEPLOYER,
      }),
    ).toBe(KNOWN_WRAPPER);
  });

  it('builds the AccountWrapper type string', () => {
    expect(accountWrapperType(ACCOUNT_PACKAGE_ID)).toBe(
      `${ACCOUNT_PACKAGE_ID}::account::AccountWrapper`,
    );
  });

  it('builds the CoinKey type string for DUSDC bag lookups', () => {
    expect(coinKeyType(ACCOUNT_PACKAGE_ID, DUSDC)).toBe(
      `${ACCOUNT_PACKAGE_ID}::account::CoinKey<${DUSDC}>`,
    );
  });

  it('parses a present AccountWrapper object as existing', () => {
    const parsed = parseAccountWrapperObject(
      {
        objectId: KNOWN_WRAPPER,
        type: `${ACCOUNT_PACKAGE_ID}::account::AccountWrapper`,
        json: {
          id: KNOWN_WRAPPER,
          account: {
            owner: DEPLOYER,
            balances: { id: '0xbag', size: '0' },
          },
        },
      },
      { accountPackageId: ACCOUNT_PACKAGE_ID },
    );

    expect(parsed).toEqual({
      wrapperId: KNOWN_WRAPPER,
      exists: true,
      owner: DEPLOYER,
      balancesBagId: '0xbag',
    });
  });

  it('treats a missing object as non-existent', () => {
    expect(parseAccountWrapperObject(null, { accountPackageId: ACCOUNT_PACKAGE_ID })).toEqual({
      wrapperId: undefined,
      exists: false,
      owner: undefined,
      balancesBagId: undefined,
    });
  });
});

describe('accountWrapper balance parse', () => {
  it('parses a Balance dynamic-field value into base units and decimals', () => {
    expect(
      parseAccountWrapperBalance(
        {
          value: '2500000',
        },
        { quoteAssetDecimals: 6 },
      ),
    ).toEqual({
      dusdcBalanceBaseUnits: 2_500_000n,
      dusdcBalance: 2.5,
    });
  });

  it('returns zero when the CoinKey field is missing', () => {
    expect(parseAccountWrapperBalance(null, { quoteAssetDecimals: 6 })).toEqual({
      dusdcBalanceBaseUnits: 0n,
      dusdcBalance: 0,
    });
  });

  it('parses nested Balance object shapes from gRPC JSON', () => {
    expect(
      parseAccountWrapperBalance(
        {
          value: { fields: { value: '1000000' } },
        },
        { quoteAssetDecimals: 6 },
      ),
    ).toEqual({
      dusdcBalanceBaseUnits: 1_000_000n,
      dusdcBalance: 1,
    });
  });
});

describe('fetchAccountWrapper', () => {
  it('treats object-not-found as a missing wrapper', async () => {
    const client = {
      core: {
        getObject: vi.fn().mockRejectedValue(new Error(`Object ${KNOWN_WRAPPER} not found`)),
        getDynamicField: vi.fn(),
      },
    };

    await expect(
      fetchAccountWrapper({
        client,
        owner: DEPLOYER,
        accountPackageId: ACCOUNT_PACKAGE_ID,
        accountRegistryId: ACCOUNT_REGISTRY_ID,
      }),
    ).resolves.toEqual({
      wrapperId: KNOWN_WRAPPER,
      exists: false,
      owner: undefined,
      balancesBagId: undefined,
    });
  });

  it('rethrows non-not-found gRPC errors so the UI does not offer create', async () => {
    const client = {
      core: {
        getObject: vi.fn().mockRejectedValue(new Error('gRPC unavailable')),
        getDynamicField: vi.fn(),
      },
    };

    await expect(
      fetchAccountWrapper({
        client,
        owner: DEPLOYER,
        accountPackageId: ACCOUNT_PACKAGE_ID,
        accountRegistryId: ACCOUNT_REGISTRY_ID,
      }),
    ).rejects.toThrow(/gRPC unavailable/);
  });
});
