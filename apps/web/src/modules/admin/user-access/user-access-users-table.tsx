'use client';

import { MoreHorizontal, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { GlassCard } from '@/components/studio';
import { relativeTime } from '@/lib/ui-utils';
import { cn } from '@/utils/cn';
import type { UserAccessRow, UserStatusFilter } from './types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  const colors = [
    'bg-blue-500/20 text-blue-300',
    'bg-purple-500/20 text-purple-300',
    'bg-green-500/20 text-green-300',
    'bg-amber-500/20 text-amber-300',
    'bg-cyan-500/20 text-cyan-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length]!;
}

function roleBadgeClass(role: string): string {
  if (role === 'Super Admin') return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  if (role === 'Integration') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (role === 'Developer') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  return 'bg-secondary text-muted-foreground border-border';
}

interface UserAccessUsersTableProps {
  users: UserAccessRow[];
  allCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: UserStatusFilter;
  onStatusFilterChange: (v: UserStatusFilter) => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  onManage: (user: UserAccessRow) => void;
  currentUserId?: string;
  savingId?: string | null;
}

export function UserAccessUsersTable({
  users,
  allCount,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onManage,
  currentUserId,
  savingId,
}: UserAccessUsersTableProps) {
  const start = allCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, allCount);

  return (
    <GlassCard className="!p-0" noPadding>
      <div className="p-4 border-b border-border/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search users by name, email, or role..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs" type="button" disabled>
              Filters
            </Button>
            <Select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as UserStatusFilter)}
              className="h-9 text-xs w-[120px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="py-3 px-4 font-medium">USER</th>
              <th className="py-3 px-4 font-medium">ROLE</th>
              <th className="py-3 px-4 font-medium">STATUS</th>
              <th className="py-3 px-4 font-medium hidden md:table-cell">LAST ACTIVE</th>
              <th className="py-3 px-4 font-medium hidden lg:table-cell">ADDED ON</th>
              <th className="py-3 px-4 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                        avatarColor(user.displayName),
                      )}
                    >
                      {initials(user.displayName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-md text-xs border',
                      roleBadgeClass(user.displayRole),
                    )}
                  >
                    {user.displayRole}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        user.status === 'active' ? 'bg-green-400' : 'bg-red-400',
                      )}
                    />
                    {user.status}
                  </span>
                </td>
                <td className="py-3 px-4 hidden md:table-cell text-muted-foreground text-xs">
                  {user.lastActiveAt ? relativeTime(user.lastActiveAt) : '—'}
                </td>
                <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground text-xs">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={savingId === user.id}
                      onClick={() => onManage(user)}
                    >
                      <Settings className="w-3.5 h-3.5 mr-1" />
                      Manage
                    </Button>
                    {user.id !== currentUserId && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button" disabled>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-border/60 text-xs text-muted-foreground">
        <span>
          Showing {start} to {end} of {allCount} users
        </span>
        <nav className="flex items-center gap-2" aria-label="Users pagination">
          <Select
            aria-label="Users per page"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 text-xs w-[90px]"
          >
            <option value="5">5 / page</option>
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous users page"
          >
            ‹
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8 p-0 text-xs"
              onClick={() => onPageChange(p)}
              aria-label={`Go to users page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next users page"
          >
            ›
          </Button>
        </nav>
      </div>
    </GlassCard>
  );
}
