import { z } from 'zod';

export const bottlerIdSchema = z.enum(['5000', '4900', '4600']);

export const bottlerSalesOfficeConfigSchema = z.object({
  bottler: bottlerIdSchema,
  label: z.string().optional(),
  perOfficePartnerLimit: z.number().int().positive().default(20),
  roles: z.array(z.string().min(1)).min(1),
  offices: z.array(z.string().min(1)).min(1),
});

export type BottlerSalesOfficeConfig = z.infer<typeof bottlerSalesOfficeConfigSchema>;

export function parseBottlerSalesOfficeConfig(input: unknown): BottlerSalesOfficeConfig {
  return bottlerSalesOfficeConfigSchema.parse(input);
}

export function validateBottlerSalesOfficeConfig(input: unknown) {
  const result = bottlerSalesOfficeConfigSchema.safeParse(input);
  if (!result.success) {
    return { valid: false as const, errors: result.error.flatten() };
  }
  return { valid: true as const, normalized: result.data };
}
