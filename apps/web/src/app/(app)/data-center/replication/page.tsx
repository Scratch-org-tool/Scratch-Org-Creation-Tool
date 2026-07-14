import { redirect } from 'next/navigation';

export default function DataReplicationRedirectPage() {
  redirect('/data-center?tab=replication');
}
