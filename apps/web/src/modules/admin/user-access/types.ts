import type { AppModule } from '@sfcc/shared';

export type UserAccessTab = 'users' | 'roles' | 'permissions' | 'activity';

export type UserStatusFilter = 'all' | 'active' | 'inactive';

export interface UserAccessStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  pendingInvites: number;
  totalTrendPct: number | null;
}

export interface UserAccessRow {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  grantedModules: AppModule[];
  effectiveModules: AppModule[];
  displayRole: string;
  status: 'active' | 'inactive';
  lastActiveAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  optimisticState?: 'saving';
}

export interface UserAccessOverview {
  stats: UserAccessStats;
  users: UserAccessRow[];
}

export interface ManageDraft {
  role: 'admin' | 'user';
  grantedModules: AppModule[];
  status: 'active' | 'inactive';
}
