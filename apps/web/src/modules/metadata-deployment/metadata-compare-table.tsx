'use client';

import { DIFF_TYPE_LABELS, isDeployableDiffType, itemKey } from './types';
import type { MetadataCompareHook } from './use-metadata-compare';
import { MetadataObjectChildren } from './metadata-object-children';

const BADGE_CLASS: Record<string, string> = {
  new: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  changed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  deleted: 'bg-red-500/15 text-red-700 dark:text-red-400',
  same: 'bg-muted text-muted-foreground',
};

export function MetadataCompareTable({ w }: { w: MetadataCompareHook }) {
  if (w.sessionStatus === 'running') {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Comparing metadata… this may take a minute.
      </div>
    );
  }

  const rows = w.items;
  const deployable = rows.filter((i) => isDeployableDiffType(i.diffType));
  const allVisibleSelected = deployable.length > 0 && deployable.every((i) => w.selectedKeys.has(itemKey(i.metadataType, i.fullName)));

  return (
    <div className="border border-border rounded-md overflow-hidden min-h-[16rem]">
      <div className="overflow-x-auto max-h-[24rem] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0 z-[1]">
            <tr>
              <th className="p-2 w-8">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => w.toggleSelectAllVisible()}
                  aria-label="Select all visible"
                />
              </th>
              <th className="p-2 text-left font-medium">Name</th>
              <th className="p-2 text-left font-medium hidden sm:table-cell">Type</th>
              <th className="p-2 text-left font-medium hidden md:table-cell">Changed on</th>
              <th className="p-2 text-left font-medium hidden lg:table-cell">Changed by</th>
              <th className="p-2 text-left font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const key = itemKey(item.metadataType, item.fullName);
              const selected = w.selectedItem?.fullName === item.fullName && w.selectedItem.metadataType === item.metadataType;
              const canSelect = isDeployableDiffType(item.diffType);
              return (
                <tr
                  key={key}
                  className={`border-t border-border hover:bg-muted/30 ${selected ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={w.selectedKeys.has(key)}
                      disabled={!canSelect}
                      onChange={() => w.toggleSelect(item)}
                      aria-label={`Select ${item.fullName} for deployment`}
                    />
                  </td>
                  <td className="p-2 font-mono text-[11px]">
                    <button
                      type="button"
                      className="text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                      onClick={() => void w.loadItemDiff(item)}
                      aria-label={`View diff for ${item.fullName}`}
                      aria-pressed={selected}
                    >
                      {item.fullName}
                    </button>
                  </td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{item.metadataType}</td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">
                    {item.lastModifiedDate ? new Date(item.lastModifiedDate).toLocaleString() : '—'}
                  </td>
                  <td className="p-2 hidden lg:table-cell text-muted-foreground">{item.lastModifiedBy ?? '—'}</td>
                  <td className="p-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE_CLASS[item.diffType]}`}>
                      {DIFF_TYPE_LABELS[item.diffType]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !w.sessionLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No items match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {w.itemsTotal > 100 && (
        <nav className="flex justify-between items-center px-3 py-2 border-t border-border text-xs" aria-label="Metadata pagination">
          <span className="text-muted-foreground" aria-current="page">Page {w.page} · {w.itemsTotal} items</span>
          <div className="flex gap-1">
            <button
              type="button"
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
              disabled={w.page <= 1}
              onClick={() => w.setPage(w.page - 1)}
              aria-label="Previous metadata page"
            >
              Prev
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
              disabled={w.page * 100 >= w.itemsTotal}
              onClick={() => w.setPage(w.page + 1)}
              aria-label="Next metadata page"
            >
              Next
            </button>
          </div>
        </nav>
      )}
      {w.selectedItem?.metadataType === 'CustomObject' && (
        <MetadataObjectChildren w={w} />
      )}
    </div>
  );
}
