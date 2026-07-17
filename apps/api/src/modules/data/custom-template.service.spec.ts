import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';

const db = vi.hoisted(() => ({
  dataQueryTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import {
  CustomTemplateService,
  customTemplateCreateSchema,
  extractTemplateVariables,
} from './custom-template.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Accounts by region',
    description: null,
    objectName: 'Account',
    soqlTemplate: "SELECT Id FROM Account WHERE Region__c = '{{region}}'",
    variables: ['region'],
    shared: false,
    createdBy: 'DPT_owner',
    createdAt: new Date('2026-07-17T00:00:00.000Z'),
    updatedAt: new Date('2026-07-17T00:00:00.000Z'),
    ...overrides,
  };
}

describe('extractTemplateVariables', () => {
  it('finds unique {{placeholders}}', () => {
    expect(
      extractTemplateVariables(
        "SELECT Id FROM Account WHERE A = '{{region}}' AND B = '{{ region }}' LIMIT {{limit}}",
      ),
    ).toEqual(['region', 'limit']);
  });
});

describe('customTemplateCreateSchema', () => {
  it('requires a SELECT ... FROM statement without semicolons', () => {
    const base = { name: 'X', objectName: 'Account' };
    expect(
      customTemplateCreateSchema.safeParse({
        ...base,
        soqlTemplate: 'SELECT Id FROM Account',
      }).success,
    ).toBe(true);
    expect(
      customTemplateCreateSchema.safeParse({
        ...base,
        soqlTemplate: 'DELETE FROM Account',
      }).success,
    ).toBe(false);
    expect(
      customTemplateCreateSchema.safeParse({
        ...base,
        soqlTemplate: 'SELECT Id FROM Account; DROP TABLE x',
      }).success,
    ).toBe(false);
  });

  it('validates the object API name', () => {
    expect(
      customTemplateCreateSchema.safeParse({
        name: 'X',
        objectName: 'My_Object__c',
        soqlTemplate: 'SELECT Id FROM My_Object__c',
      }).success,
    ).toBe(true);
    expect(
      customTemplateCreateSchema.safeParse({
        name: 'X',
        objectName: 'bad name!',
        soqlTemplate: 'SELECT Id FROM Account',
      }).success,
    ).toBe(false);
  });
});

describe('CustomTemplateService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists own plus shared templates', async () => {
    db.dataQueryTemplate.findMany.mockResolvedValue([row()]);
    const service = new CustomTemplateService();
    const list = await service.list('DPT_owner');
    expect(db.dataQueryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ createdBy: 'DPT_owner' }, { shared: true }] },
      }),
    );
    expect(list[0].source).toBe('custom');
    expect(list[0].variables).toEqual(['region']);
  });

  it('derives variables on create and maps unique-name conflicts', async () => {
    db.dataQueryTemplate.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      row(data),
    );
    const service = new CustomTemplateService();
    const created = await service.create(
      {
        name: 'Contacts',
        objectName: 'Contact',
        soqlTemplate: 'SELECT Id FROM Contact LIMIT {{limit}}',
      },
      'DPT_owner',
    );
    expect(created.variables).toEqual(['limit']);

    db.dataQueryTemplate.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create(
        { name: 'Contacts', objectName: 'Contact', soqlTemplate: 'SELECT Id FROM Contact' },
        'DPT_owner',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks non-owners from modifying a template', async () => {
    db.dataQueryTemplate.findUnique.mockResolvedValue(row());
    const service = new CustomTemplateService();
    await expect(service.remove('t1', 'DPT_other')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
