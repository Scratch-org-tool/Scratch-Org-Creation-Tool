import { redirect } from 'next/navigation';

export default function ReleasesRedirectPage() {
  redirect('/deployment-center/azure');
}
