import { DualInvestmentPage } from '../../../src/components/DualInvestmentPage';

export default function Page({ searchParams }: { searchParams?: { mode?: string } }) {
  return <DualInvestmentPage initialMode={searchParams?.mode === 'target-sale' ? 'target-sale' : 'target-buy'} />;
}
