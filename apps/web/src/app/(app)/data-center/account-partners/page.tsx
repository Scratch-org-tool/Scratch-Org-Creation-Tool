import { redirect } from 'next/navigation';

export default function AccountPartnersRedirectPage() {
  redirect('/data-center?tab=account-partners');
}
