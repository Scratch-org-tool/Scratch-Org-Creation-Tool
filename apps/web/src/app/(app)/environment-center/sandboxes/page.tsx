import { redirect } from 'next/navigation';

export default function SandboxesPage() {
  redirect('/environment-center?tab=salesforce#scratch-orgs');
}
