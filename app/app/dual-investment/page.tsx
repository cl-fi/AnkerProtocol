import { DualInvestmentPage } from '../../../src/components/DualInvestmentPage';
import { redirect } from 'next/navigation';

export default function Page({ searchParams }: { searchParams?: { mode?: string } }) {
  if (searchParams?.mode) {
    redirect('/app/dual-investment');
  }
  return <DualInvestmentPage />;
}
