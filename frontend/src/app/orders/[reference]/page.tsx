import { OrderTrackingPage } from '../../../features/customer/components/order-tracking-page';
export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <OrderTrackingPage reference={reference} />;
}
