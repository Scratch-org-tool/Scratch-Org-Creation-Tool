import { DriftMonitorDetail } from '@/modules/drift';

export default async function DriftMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriftMonitorDetail monitorId={id} />;
}
