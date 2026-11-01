import { CustomerMenuPage } from '../../../features/customer/components/customer-menu-page';
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CustomerMenuPage token={token} />;
}
