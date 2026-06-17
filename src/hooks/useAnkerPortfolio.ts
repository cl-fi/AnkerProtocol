'use client';

import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import {
  parseOwnedProductNotes,
  productNoteType,
  type AnkerProductNoteRecord,
} from '../sui/ankerPortfolio';
import { DEFAULT_ANKER_CONFIG, type AnkerProtocolConfig } from '../sui/ankerTransactions';

export function useAnkerPortfolio(config: AnkerProtocolConfig = DEFAULT_ANKER_CONFIG) {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const packageConfigured = config.packageId !== '0x0' && config.packageId.length > 0;

  return useQuery<AnkerProductNoteRecord[]>({
    queryKey: ['anker-portfolio', account?.address, config.packageId],
    enabled: Boolean(account?.address) && packageConfigured,
    queryFn: async () => {
      const objects: unknown[] = [];
      let cursor: string | null | undefined;

      do {
        const page = await client.listOwnedObjects({
          owner: account!.address,
          type: productNoteType(config.packageId),
          include: { json: true },
          cursor,
          limit: 50,
        });
        objects.push(...page.objects);
        cursor = page.hasNextPage ? page.cursor : null;
      } while (cursor);

      return parseOwnedProductNotes(objects, {
        packageId: config.packageId,
        quoteAssetDecimals: config.quoteAssetDecimals,
      });
    },
  });
}
