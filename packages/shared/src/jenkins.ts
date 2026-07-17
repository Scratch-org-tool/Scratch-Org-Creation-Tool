import { z } from 'zod';

/** Folder-qualified Jenkins job path, e.g. `platform/sf-deploy`. */
export const jenkinsJobPathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^\s]+$/, 'Job path must not contain whitespace');

export const jenkinsTriggerSchema = z
  .object({
    path: jenkinsJobPathSchema,
    parameters: z.record(z.string().max(4096)).optional(),
  })
  .strict();

export type JenkinsTriggerInput = z.infer<typeof jenkinsTriggerSchema>;

export const jenkinsStopSchema = z
  .object({
    path: jenkinsJobPathSchema,
    number: z.number().int().positive(),
  })
  .strict();

export type JenkinsStopInput = z.infer<typeof jenkinsStopSchema>;

/** Map a Jenkins ball color to a coarse UI status string. */
export function jenkinsColorToStatus(color: string | undefined): string {
  if (!color) return 'unknown';
  const base = color.replace(/_anime$/, '');
  if (color.endsWith('_anime')) return 'running';
  switch (base) {
    case 'blue':
    case 'green':
      return 'completed';
    case 'red':
      return 'failed';
    case 'yellow':
      return 'partial';
    case 'aborted':
      return 'cancelled';
    case 'disabled':
    case 'grey':
    case 'notbuilt':
      return 'pending';
    default:
      return 'unknown';
  }
}

/** Map a Jenkins build result to the shared status vocabulary. */
export function jenkinsResultToStatus(
  result: string | null | undefined,
  building: boolean,
): string {
  if (building) return 'running';
  switch (result) {
    case 'SUCCESS':
      return 'completed';
    case 'FAILURE':
      return 'failed';
    case 'UNSTABLE':
      return 'partial';
    case 'ABORTED':
      return 'cancelled';
    case 'NOT_BUILT':
      return 'pending';
    default:
      return result ? result.toLowerCase() : 'pending';
  }
}
