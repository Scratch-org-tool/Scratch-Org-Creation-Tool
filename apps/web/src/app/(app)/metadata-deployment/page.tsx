import { redirect } from 'next/navigation';

/**
 * Org-to-Org Metadata was consolidated into the Deployment Workbench — one
 * governed flow for metadata comparison and deployment.
 */
export default function MetadataDeploymentRedirectPage() {
  redirect('/deployment-workbench?flow=metadata');
}
