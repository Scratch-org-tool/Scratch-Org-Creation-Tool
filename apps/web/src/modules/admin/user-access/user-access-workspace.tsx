'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmBanner, InlineAlert, PageHeader } from '@/components/studio';
import { UserAccessTabs } from './user-access-tabs';
import { UserAccessManageDrawer } from './user-access-manage-drawer';
import { UserAccessQuickCards } from './user-access-quick-cards';
import { UserAccessStatCards } from './user-access-stat-cards';
import { UserAccessUsersTable } from './user-access-users-table';
import { UserAccessActivityLog } from './user-access-activity-log';
import { UserAccessRoles } from './user-access-roles';
import { UserAccessPermissions } from './user-access-permissions';
import { useUserAccessWorkspace } from './use-user-access-workspace';

export function UserAccessWorkspace() {
  const {
    profile,
    overview,
    loading,
    saving,
    error,
    setError,
    tab,
    setTab,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    exportCsv,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    filteredUsers,
    paginatedUsers,
    manageUser,
    draft,
    setDraft,
    openManage,
    closeManage,
    toggleDraftModule,
    saveManage,
    pendingRole,
    setPendingRole,
    confirmRoleChange,
    optimisticAnnouncement,
    refresh,
  } = useUserAccessWorkspace();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const showDataSkeleton = loading && !overview;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{optimisticAnnouncement}</p>
      <PageHeader
        title="User Access"
        subtitle="Manage users, roles, and permissions across the platform"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading} disabled={saving}>
              Refresh
            </Button>
            <Button
              size="sm"
              disabled
              title="Coming soon"
              className="cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Invite User
            </Button>
          </>
        }
      />

      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      {pendingRole && (
        <ConfirmBanner
          title={`Change role to ${pendingRole.nextRole === 'admin' ? 'Super Admin' : 'standard user'}?`}
          message="This updates the user's permissions across the app."
          confirmLabel="Change role"
          onConfirm={() => void confirmRoleChange()}
          onCancel={() => setPendingRole(null)}
          loading={saving}
        />
      )}

      {showDataSkeleton ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </>
      ) : (
        <>
      <UserAccessStatCards stats={overview?.stats ?? null} />

      <UserAccessTabs active={tab} onChange={setTab} />

      {tab === 'users' && (
        <UserAccessUsersTable
          users={paginatedUsers}
          allCount={filteredUsers.length}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          onExport={exportCsv}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onManage={openManage}
          savingId={saving ? manageUser?.id : null}
        />
      )}

      {tab === 'roles' && <UserAccessRoles users={overview?.users ?? []} />}
      {tab === 'permissions' && <UserAccessPermissions />}
      {tab === 'activity' && <UserAccessActivityLog users={overview?.users ?? []} />}

      {tab === 'users' && <UserAccessQuickCards onNavigate={setTab} />}

      <UserAccessManageDrawer
        user={manageUser}
        draft={draft}
        saving={saving}
        error={error}
        onClose={closeManage}
        onDraftChange={setDraft}
        onToggleModule={toggleDraftModule}
        onSave={() => void saveManage()}
        isSelf={manageUser?.id === profile.id}
      />
        </>
      )}
    </div>
  );
}
