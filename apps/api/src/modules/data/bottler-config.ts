import type { BottlerSalesOfficeConfig } from '@sfcc/shared';

export const BOTTLER_CONFIG = {
  '5000': {
    label: 'Northeast',
    roles: ['ZR'] as const,
    defaultSheet: '5000-Partners',
    offices: [
      'S003', 'S008', 'S010', 'S011', 'S012', 'S014', 'S016', 'S017', 'S019',
      'S020', 'S021', 'S023', 'S024', 'S025', 'S027', 'S028', 'S029', 'S033',
    ],
  },
  '4900': {
    label: 'Abarta',
    roles: ['ZR', 'ZK', 'ZL'] as const,
    defaultSheet: '4900-Abarta',
    offices: ['Q000', 'Q003', 'Q004', 'Q005', 'Q007', 'Q008', 'Q010', 'Q011', 'Q012', 'Q013', 'Q016'],
  },
  '4600': {
    label: 'Reyes',
    roles: ['ZR', 'ZK', 'ZJ', 'ZN'] as const,
    defaultSheet: '4600-partners',
    offices: [
      'K003', 'K006', 'K007', 'K008', 'K011', 'K012', 'K014', 'K016', 'K018', 'K019',
      'K020', 'K022', 'K026', 'K032', 'K035', 'K036', 'K043', 'K045', 'K046', 'K048',
      'K049', 'K050', 'K051', 'K052', 'K053', 'K054', 'K055', 'K056', 'K057', 'K058',
      'K059', 'K060', 'K064', 'K065', 'K068', 'K069', 'K070', 'K072', 'K073', 'K074',
      'K075', 'K079', 'K080', 'K081', 'K082', 'K084', 'K087',
    ],
  },
} as const;

export type BottlerId = keyof typeof BOTTLER_CONFIG;

export function resolveSalesOfficeConfig(
  bottler: BottlerId,
  uploaded?: BottlerSalesOfficeConfig,
): BottlerSalesOfficeConfig {
  if (uploaded) return uploaded;
  const cfg = BOTTLER_CONFIG[bottler];
  return {
    bottler,
    label: cfg.label,
    perOfficePartnerLimit: 20,
    roles: [...cfg.roles],
    offices: [...cfg.offices],
  };
}

export function normalizeAccountKey(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}
