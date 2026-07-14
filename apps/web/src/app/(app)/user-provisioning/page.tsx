import { redirect } from 'next/navigation';

export default function UserProvisioningRedirectPage() {
  redirect('/org-setup?tab=users-cona');
}
