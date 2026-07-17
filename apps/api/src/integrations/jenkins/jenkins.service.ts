import { Injectable, Logger } from '@nestjs/common';

export interface JenkinsJobSummary {
  /** Folder-qualified path, e.g. `platform/sf-deploy`. */
  id: string;
  name: string;
  url?: string;
  /** Jenkins color, e.g. blue, red, disabled, blue_anime. */
  color?: string;
  buildable?: boolean;
  lastBuild?: {
    number: number;
    result: string | null;
    building: boolean;
    timestamp: number;
    durationMs: number;
  } | null;
}

export interface JenkinsParameterDefinition {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string | boolean | null;
  choices?: string[];
}

export interface JenkinsBuildSummary {
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  durationMs: number;
  url?: string;
}

export interface JenkinsJobDetail extends JenkinsJobSummary {
  description?: string | null;
  parameters: JenkinsParameterDefinition[];
  builds: JenkinsBuildSummary[];
  inQueue?: boolean;
}

export interface JenkinsTriggerResult {
  triggered: boolean;
  job: string;
  queueId: number | null;
  buildNumber: number | null;
  provider: 'jenkins';
}

export interface JenkinsLogChunk {
  text: string;
  nextStart: number;
  hasMore: boolean;
  building: boolean;
}

interface RawJob {
  name: string;
  url?: string;
  color?: string;
  buildable?: boolean;
  jobs?: RawJob[];
  lastBuild?: {
    number?: number;
    result?: string | null;
    building?: boolean;
    timestamp?: number;
    duration?: number;
  } | null;
}

const JOB_TREE =
  'jobs[name,url,color,buildable,lastBuild[number,result,building,timestamp,duration],' +
  'jobs[name,url,color,buildable,lastBuild[number,result,building,timestamp,duration],' +
  'jobs[name,url,color,buildable,lastBuild[number,result,building,timestamp,duration]]]]';

/**
 * REST client for a Jenkins controller. Configured via JENKINS_URL,
 * JENKINS_USER, and JENKINS_TOKEN. Handles CSRF crumbs, folder hierarchies
 * (up to three levels), parameterized builds, and progressive console logs.
 */
@Injectable()
export class JenkinsService {
  private readonly logger = new Logger(JenkinsService.name);

  private get url(): string {
    return (process.env.JENKINS_URL ?? '').replace(/\/$/, '');
  }

  private get user(): string {
    return process.env.JENKINS_USER ?? '';
  }

  private get token(): string {
    return process.env.JENKINS_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.url);
  }

  /** Connectivity + version probe for the UI status banner. */
  async getStatus(): Promise<{
    configured: boolean;
    reachable: boolean;
    version: string | null;
    url: string | null;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { configured: false, reachable: false, version: null, url: null };
    }
    try {
      const res = await this.request('/api/json?tree=mode');
      return {
        configured: true,
        reachable: res.ok,
        version: res.headers.get('x-jenkins'),
        url: this.url,
        ...(res.ok ? {} : { error: `Jenkins responded with HTTP ${res.status}` }),
      };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        version: null,
        url: this.url,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /** Flattened job list including jobs nested in folders. */
  async listJobs(): Promise<JenkinsJobSummary[]> {
    if (!this.isConfigured()) return [];
    try {
      const res = await this.request(`/api/json?tree=${encodeURIComponent(JOB_TREE)}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { jobs?: RawJob[] };
      return this.flattenJobs(data.jobs ?? [], '');
    } catch (error) {
      this.logger.warn(
        `listJobs failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getJobDetail(jobPath: string): Promise<JenkinsJobDetail | null> {
    if (!this.isConfigured()) return null;
    const tree =
      'name,url,color,buildable,description,inQueue,' +
      'property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]],' +
      'builds[number,result,building,timestamp,duration,url]{0,20},' +
      'lastBuild[number,result,building,timestamp,duration]';
    const res = await this.request(
      `${this.jobUrlPath(jobPath)}/api/json?tree=${encodeURIComponent(tree)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name: string;
      url?: string;
      color?: string;
      buildable?: boolean;
      description?: string | null;
      inQueue?: boolean;
      property?: Array<{
        parameterDefinitions?: Array<{
          name: string;
          type: string;
          description?: string;
          defaultParameterValue?: { value?: string | boolean | null } | null;
          choices?: string[];
        }>;
      }>;
      builds?: Array<{
        number: number;
        result: string | null;
        building?: boolean;
        timestamp?: number;
        duration?: number;
        url?: string;
      }>;
      lastBuild?: RawJob['lastBuild'];
    };

    const parameters: JenkinsParameterDefinition[] = (data.property ?? [])
      .flatMap((prop) => prop.parameterDefinitions ?? [])
      .map((def) => ({
        name: def.name,
        type: def.type,
        description: def.description,
        defaultValue: def.defaultParameterValue?.value ?? null,
        choices: def.choices,
      }));

    return {
      id: jobPath,
      name: data.name,
      url: data.url,
      color: data.color,
      buildable: data.buildable,
      description: data.description,
      inQueue: data.inQueue,
      parameters,
      lastBuild: this.mapBuild(data.lastBuild),
      builds: (data.builds ?? []).map((build) => ({
        number: build.number,
        result: build.result ?? null,
        building: Boolean(build.building),
        timestamp: build.timestamp ?? 0,
        durationMs: build.duration ?? 0,
        url: build.url,
      })),
    };
  }

  /**
   * Multibranch pipelines expose branches as child jobs; classic jobs fall
   * back to a single implicit branch so existing deploy flows keep working.
   */
  async listBranches(jobPath: string): Promise<string[]> {
    if (!this.isConfigured()) return ['main'];
    try {
      const res = await this.request(
        `${this.jobUrlPath(jobPath)}/api/json?tree=${encodeURIComponent('jobs[name]')}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { jobs?: Array<{ name: string }> };
        if (data.jobs && data.jobs.length > 0) {
          return data.jobs.map((job) => job.name);
        }
      }
    } catch (error) {
      this.logger.warn(
        `listBranches failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return ['main'];
  }

  /**
   * Trigger a build (optionally parameterized). A second positional string is
   * treated as a BRANCH parameter for backwards compatibility with the
   * strategy-based deploy flow.
   */
  async triggerBuild(
    jobPath: string,
    branchOrParams?: string | Record<string, string>,
  ): Promise<JenkinsTriggerResult> {
    const parameters: Record<string, string> =
      typeof branchOrParams === 'string'
        ? branchOrParams
          ? { BRANCH: branchOrParams }
          : {}
        : (branchOrParams ?? {});

    if (!this.isConfigured()) {
      return { triggered: false, job: jobPath, queueId: null, buildNumber: null, provider: 'jenkins' };
    }

    const hasParams = Object.keys(parameters).length > 0;
    const endpoint = hasParams ? 'buildWithParameters' : 'build';
    const body = hasParams ? new URLSearchParams(parameters).toString() : undefined;

    const crumb = await this.getCrumb();
    const res = await this.request(`${this.jobUrlPath(jobPath)}/${endpoint}`, {
      method: 'POST',
      headers: {
        ...(crumb ? { [crumb.field]: crumb.value } : {}),
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body,
    });

    if (!res.ok && res.status !== 201) {
      throw new Error(`Jenkins refused the build request (HTTP ${res.status})`);
    }

    const location = res.headers.get('location');
    const queueId = location?.match(/\/queue\/item\/(\d+)/)?.[1];
    return {
      triggered: true,
      job: jobPath,
      queueId: queueId ? Number(queueId) : null,
      buildNumber: null,
      provider: 'jenkins',
    };
  }

  /** Resolve a queue item to its build number once Jenkins schedules it. */
  async getQueueItem(queueId: number): Promise<{
    buildNumber: number | null;
    cancelled: boolean;
    why: string | null;
  }> {
    const res = await this.request(`/queue/item/${queueId}/api/json`);
    if (!res.ok) return { buildNumber: null, cancelled: false, why: null };
    const data = (await res.json()) as {
      cancelled?: boolean;
      why?: string | null;
      executable?: { number?: number } | null;
    };
    return {
      buildNumber: data.executable?.number ?? null,
      cancelled: Boolean(data.cancelled),
      why: data.why ?? null,
    };
  }

  async getBuild(jobPath: string, buildNumber: number): Promise<JenkinsBuildSummary | null> {
    const res = await this.request(
      `${this.jobUrlPath(jobPath)}/${buildNumber}/api/json?tree=${encodeURIComponent('number,result,building,timestamp,duration,url')}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      number: number;
      result: string | null;
      building?: boolean;
      timestamp?: number;
      duration?: number;
      url?: string;
    };
    return {
      number: data.number,
      result: data.result ?? null,
      building: Boolean(data.building),
      timestamp: data.timestamp ?? 0,
      durationMs: data.duration ?? 0,
      url: data.url,
    };
  }

  /** Progressive console output — poll with the returned nextStart offset. */
  async getConsoleLog(
    jobPath: string,
    buildNumber: number,
    start = 0,
  ): Promise<JenkinsLogChunk> {
    const res = await this.request(
      `${this.jobUrlPath(jobPath)}/${buildNumber}/logText/progressiveText?start=${start}`,
    );
    if (!res.ok) {
      return { text: '', nextStart: start, hasMore: false, building: false };
    }
    const text = await res.text();
    const nextStart = Number(res.headers.get('x-text-size') ?? start);
    const hasMore = res.headers.get('x-more-data') === 'true';
    return { text, nextStart, hasMore, building: hasMore };
  }

  async stopBuild(jobPath: string, buildNumber: number): Promise<{ stopped: boolean }> {
    const crumb = await this.getCrumb();
    const res = await this.request(`${this.jobUrlPath(jobPath)}/${buildNumber}/stop`, {
      method: 'POST',
      headers: crumb ? { [crumb.field]: crumb.value } : {},
    });
    return { stopped: res.ok || res.status === 302 };
  }

  // ---------------------------------------------------------------- helpers

  private flattenJobs(jobs: RawJob[], prefix: string): JenkinsJobSummary[] {
    const result: JenkinsJobSummary[] = [];
    for (const job of jobs) {
      const path = prefix ? `${prefix}/${job.name}` : job.name;
      if (job.jobs && job.jobs.length > 0 && job.buildable !== true) {
        // Folder (or multibranch container) — recurse into children.
        result.push(...this.flattenJobs(job.jobs, path));
      } else {
        result.push({
          id: path,
          name: path,
          url: job.url,
          color: job.color,
          buildable: job.buildable,
          lastBuild: this.mapBuild(job.lastBuild),
        });
      }
    }
    return result;
  }

  private mapBuild(build: RawJob['lastBuild']): JenkinsJobSummary['lastBuild'] {
    if (!build || typeof build.number !== 'number') return null;
    return {
      number: build.number,
      result: build.result ?? null,
      building: Boolean(build.building),
      timestamp: build.timestamp ?? 0,
      durationMs: build.duration ?? 0,
    };
  }

  /** `folder/job` → `/job/folder/job/job` URL segments. */
  private jobUrlPath(jobPath: string): string {
    return jobPath
      .split('/')
      .filter(Boolean)
      .map((segment) => `/job/${encodeURIComponent(segment)}`)
      .join('');
  }

  private async getCrumb(): Promise<{ field: string; value: string } | null> {
    try {
      const res = await this.request('/crumbIssuer/api/json');
      if (!res.ok) return null;
      const data = (await res.json()) as { crumbRequestField?: string; crumb?: string };
      if (!data.crumbRequestField || !data.crumb) return null;
      return { field: data.crumbRequestField, value: data.crumb };
    } catch {
      return null;
    }
  }

  private request(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.user || this.token) {
      headers.Authorization = `Basic ${Buffer.from(`${this.user}:${this.token}`).toString('base64')}`;
    }
    return fetch(`${this.url}${path}`, { ...init, headers });
  }
}
