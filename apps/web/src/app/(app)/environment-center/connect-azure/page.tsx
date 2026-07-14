import { redirect } from 'next/navigation';

export default function ConnectAzureRedirectPage() {
  redirect('/environment-center?tab=azure');
}
