import { DeploymentNotFound } from '@/components/errors/deployment-not-found';

export default function NotFound() {
  return <DeploymentNotFound variant="not-found" />;
}
