import { redirect } from 'next/navigation';

export default function ConnectOrgRedirectPage() {
  redirect('/environment-center?tab=salesforce');
}
