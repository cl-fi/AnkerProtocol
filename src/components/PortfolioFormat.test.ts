import { describe, expect, it } from 'vitest';
import { suiExplorerObjectUrl, suiExplorerTxUrl } from './PortfolioFormat';

describe('Sui explorer links', () => {
  it('uses SuiVision testnet transaction links', () => {
    expect(suiExplorerTxUrl('0xdigest')).toBe('https://testnet.suivision.xyz/txblock/0xdigest');
  });

  it('uses SuiVision testnet object links', () => {
    expect(suiExplorerObjectUrl('0xobject')).toBe('https://testnet.suivision.xyz/object/0xobject');
  });
});
