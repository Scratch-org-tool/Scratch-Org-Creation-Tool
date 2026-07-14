import { redirect } from 'next/navigation';

export default function ScratchOrgsRedirectPage() {
  redirect('/environment-center?tab=salesforce#scratch-orgs');
}
