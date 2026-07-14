import { z } from 'zod';
import { bottlerIdSchema } from './bottler-sales-office-config.js';

export const userProvisionTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bottler: bottlerIdSchema,
  role: z.string().min(1),
  modules: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
});

export const userProvisionSlotSchema = z.object({
  templateId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
  bottler: bottlerIdSchema.optional(),
  modules: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

export const userProvisionTemplatesFileSchema = z.object({
  bottler: bottlerIdSchema,
  templates: z.array(userProvisionTemplateSchema).min(1),
});

export type UserProvisionTemplate = z.infer<typeof userProvisionTemplateSchema>;
export type UserProvisionSlot = z.infer<typeof userProvisionSlotSchema>;

export interface ResolvedProvisionUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
}

export function resolveUserProvisionSlots(
  slots: UserProvisionSlot[],
  templates: UserProvisionTemplate[],
): ResolvedProvisionUser[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return slots.map((slot) => {
    const tmpl = byId.get(slot.templateId);
    if (!tmpl) {
      throw new Error(`Unknown user template: ${slot.templateId}`);
    }
    return {
      firstName: slot.firstName,
      lastName: slot.lastName,
      email: slot.email,
      role: slot.role ?? tmpl.role,
      bottler: slot.bottler ?? tmpl.bottler,
      modules: slot.modules ?? tmpl.modules,
      locations: slot.locations ?? tmpl.locations,
    };
  });
}

export function slotsToLegacyUsers(slots: UserProvisionSlot[], templates: UserProvisionTemplate[]) {
  return resolveUserProvisionSlots(slots, templates);
}
