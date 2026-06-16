import { redirect } from 'next/navigation';

export default function Page({ searchParams }: { searchParams?: { mode?: string } }) {
  const query = searchParams?.mode ? `?mode=${encodeURIComponent(searchParams.mode)}` : '';
  redirect(`/app/dual-investment${query}`);
}
