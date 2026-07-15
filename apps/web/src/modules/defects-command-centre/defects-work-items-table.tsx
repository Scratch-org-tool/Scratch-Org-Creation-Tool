'use client';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { GlassCard, StatusBadge } from '@/components/studio';
import {
  IntegrationsDataTable,
  IntegrationsTableHead,
  IntegrationsTd,
  IntegrationsTh,
} from '@/modules/environment-center/integrations/integrations-data-table';
import { cn } from '@/utils/cn';
import type { AzureWorkItemSummary, DefectStatusFilter } from './types';

interface DefectsWorkItemsTableProps {
  items: AzureWorkItemSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusFilter: DefectStatusFilter;
  typeFilter: string;
  search: string;
  selectedId: number | null;
  assigneeEmail: string | null;
  projectName: string | null;
  isAdminView: boolean;
  onStatusFilterChange: (f: DefectStatusFilter) => void;
  onTypeFilterChange: (t: string) => void;
  onSearchChange: (q: string) => void;
  onPageChange: (p: number) => void;
  onSelect: (id: number) => void;
}

const STATUS_PILLS: Array<{ value: DefectStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

export function DefectsWorkItemsTable({
  items,
  total,
  page,
  pageSize,
  totalPages,
  statusFilter,
  typeFilter,
  search,
  selectedId,
  assigneeEmail,
  projectName,
  isAdminView,
  onStatusFilterChange,
  onTypeFilterChange,
  onSearchChange,
  onPageChange,
  onSelect,
}: DefectsWorkItemsTableProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <GlassCard
      title="Work Items"
      description={
        isAdminView
          ? `All defects and user stories in ${projectName ?? 'selected project'}`
          : `Assigned to ${assigneeEmail ?? 'your account'} · ${projectName ?? 'project'}`
      }
      headerAction={
        <Select
          aria-label="Filter work items by type"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="h-8 text-xs w-[130px]"
        >
          <option value="">All types</option>
          <option value="Issue">Issue</option>
          <option value="Bug">Bug</option>
          <option value="Defect">Defect</option>
          <option value="User Story">User Story</option>
          <option value="Product Backlog Item">Product Backlog Item</option>
        </Select>
      }
    >
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => onStatusFilterChange(pill.value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                statusFilter === pill.value
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-muted/30',
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <Input
          aria-label="Search work items"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, ID, or tag…"
          className="h-9 text-sm"
        />
      </div>

      <IntegrationsDataTable maxHeight="max-h-[480px]">
        <IntegrationsTableHead>
          <IntegrationsTh>ID</IntegrationsTh>
          <IntegrationsTh>Title</IntegrationsTh>
          <IntegrationsTh>Type</IntegrationsTh>
          <IntegrationsTh>Status</IntegrationsTh>
          <IntegrationsTh className="hidden md:table-cell">Priority</IntegrationsTh>
          <IntegrationsTh className="hidden lg:table-cell">Changed</IntegrationsTh>
        </IntegrationsTableHead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                {isAdminView
                  ? 'No work items found in this project.'
                  : `No items assigned to ${assigneeEmail ?? 'your email'}.`}
              </td>
            </tr>
          )}
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors',
                  selected && 'border-l-2 border-l-primary bg-primary/5',
                )}
              >
                <IntegrationsTd className="tabular-nums text-muted-foreground">#{item.id}</IntegrationsTd>
                <IntegrationsTd>
                  <button
                    type="button"
                    className="font-medium line-clamp-2 text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    onClick={() => onSelect(item.id)}
                    aria-label={`View work item ${item.id}: ${item.title}`}
                    aria-pressed={selected}
                  >
                    {item.title}
                  </button>
                </IntegrationsTd>
                <IntegrationsTd className="text-muted-foreground text-xs">{item.type}</IntegrationsTd>
                <IntegrationsTd>
                  <StatusBadge status={item.state} />
                </IntegrationsTd>
                <IntegrationsTd className="hidden md:table-cell text-muted-foreground tabular-nums">
                  {item.priority ?? '—'}
                </IntegrationsTd>
                <IntegrationsTd className="hidden lg:table-cell text-muted-foreground text-xs">
                  {item.changedDate ? new Date(item.changedDate).toLocaleDateString() : '—'}
                </IntegrationsTd>
              </tr>
            );
          })}
        </tbody>
      </IntegrationsDataTable>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40 text-sm text-muted-foreground">
        <span>
          {total === 0 ? 'No items' : `${start}–${end} of ${total}`}
        </span>
        <nav className="flex gap-2" aria-label="Work items pagination">
          <span className="sr-only" aria-current="page">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous work items page"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next work items page"
          >
            Next
          </Button>
        </nav>
      </div>
    </GlassCard>
  );
}
