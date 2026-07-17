import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { z } from 'zod';

/** Extract `{{variable}}` placeholders from a SOQL template. */
export function extractTemplateVariables(soqlTemplate: string): string[] {
  const matches = soqlTemplate.match(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g) ?? [];
  return [...new Set(matches.map((token) => token.replace(/[{}\s]/g, '')))];
}

const soqlTemplateSchema = z
  .string()
  .trim()
  .min(10)
  .max(20_000)
  .refine((value) => /^select\s/i.test(value), {
    message: 'The template must be a SELECT statement',
  })
  .refine((value) => /\sfrom\s/i.test(value), {
    message: 'The template must include a FROM clause',
  })
  .refine((value) => !/[;]/.test(value), {
    message: 'Semicolons are not allowed in SOQL templates',
  });

export const customTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    objectName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z][A-Za-z0-9_]*(__c|__mdt|__e)?$/, 'Invalid Salesforce object API name'),
    soqlTemplate: soqlTemplateSchema,
    shared: z.boolean().default(false),
  })
  .strict();

export const customTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    objectName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z][A-Za-z0-9_]*(__c|__mdt|__e)?$/, 'Invalid Salesforce object API name')
      .optional(),
    soqlTemplate: soqlTemplateSchema.optional(),
    shared: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export interface CustomTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  objectName: string;
  soqlTemplate: string;
  variables: string[];
  shared: boolean;
  createdBy: string;
  /** Distinguishes DB templates from the built-in constants. */
  source: 'custom';
  createdAt: string;
  updatedAt: string;
}

/**
 * DB-backed SOQL seed templates any team can define — the generic counterpart
 * to the hardcoded CONA `QUERY_TEMPLATES`. Owners manage their templates and
 * may share them read-only with everyone.
 */
@Injectable()
export class CustomTemplateService {
  async list(userId: string): Promise<CustomTemplateRecord[]> {
    const rows = await prisma.dataQueryTemplate.findMany({
      where: { OR: [{ createdBy: userId }, { shared: true }] },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(body: unknown, userId: string): Promise<CustomTemplateRecord> {
    const input = customTemplateCreateSchema.parse(body);
    try {
      const row = await prisma.dataQueryTemplate.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          objectName: input.objectName,
          soqlTemplate: input.soqlTemplate,
          variables: extractTemplateVariables(input.soqlTemplate),
          shared: input.shared,
          createdBy: userId,
        },
      });
      return this.toRecord(row);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(`You already have a template named '${input.name}'`);
      }
      throw error;
    }
  }

  async update(id: string, body: unknown, userId: string): Promise<CustomTemplateRecord> {
    const input = customTemplateUpdateSchema.parse(body);
    const existing = await this.requireOwned(id, userId);
    const soqlTemplate = input.soqlTemplate ?? existing.soqlTemplate;
    const row = await prisma.dataQueryTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        objectName: input.objectName,
        soqlTemplate: input.soqlTemplate,
        variables: extractTemplateVariables(soqlTemplate),
        shared: input.shared,
      },
    });
    return this.toRecord(row);
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    await this.requireOwned(id, userId);
    await prisma.dataQueryTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireOwned(id: string, userId: string) {
    const row = await prisma.dataQueryTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Template not found');
    if (row.createdBy !== userId) {
      throw new ForbiddenException('Only the template owner can modify it');
    }
    return row;
  }

  private toRecord(row: {
    id: string;
    name: string;
    description: string | null;
    objectName: string;
    soqlTemplate: string;
    variables: string[];
    shared: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): CustomTemplateRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      objectName: row.objectName,
      soqlTemplate: row.soqlTemplate,
      variables: row.variables,
      shared: row.shared,
      createdBy: row.createdBy,
      source: 'custom',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
