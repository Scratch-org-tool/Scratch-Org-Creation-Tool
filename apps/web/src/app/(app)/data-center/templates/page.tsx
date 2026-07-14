import { redirect } from 'next/navigation';

export default function QueryTemplatesRedirectPage() {
  redirect('/data-center?tab=templates');
}
