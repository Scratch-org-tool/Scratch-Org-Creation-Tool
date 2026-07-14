import { Injectable } from '@nestjs/common';

@Injectable()
export class JenkinsService {
  private readonly url = process.env.JENKINS_URL ?? '';
  private readonly user = process.env.JENKINS_USER ?? '';
  private readonly token = process.env.JENKINS_TOKEN ?? '';

  async listJobs() {
    if (!this.url) {
      return [
        { id: 'sf-deploy', name: 'sf-deploy' },
        { id: 'sf-metadata-validate', name: 'sf-metadata-validate' },
      ];
    }
    try {
      const res = await fetch(`${this.url}/api/json?tree=jobs[name,url]`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.user}:${this.token}`).toString('base64')}`,
        },
      });
      const data = await res.json() as { jobs: Array<{ name: string; url: string }> };
      return data.jobs.map((j) => ({ id: j.name, name: j.name, url: j.url }));
    } catch {
      return [];
    }
  }

  async listBranches(job: string) {
    return ['main', 'develop', 'release/prod'];
  }

  async triggerBuild(job: string, branch: string) {
    return { triggered: true, job, branch, provider: 'jenkins' };
  }
}
