'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

interface FirebaseUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  emailVerified: boolean;
  creationTime?: string;
  lastSignInTime?: string;
  username?: string;
}

export default function UserList() {
  const utils = trpc.useUtils();

  // Fetch users from database with Firebase enrichment
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.admin.listUsers.useQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingUid, setLoadingUid] = useState<string | null>(null);

  // Compute visible emails for admin check
  const visibleEmails = useMemo(
    () =>
      (users || [])
        .map((u) => u.email?.toLowerCase())
        .filter((e): e is string => !!e),
    [users]
  );

  const { data: adminMap, isLoading: adminMapLoading } =
    trpc.admin.checkAdminsByEmail.useQuery(
      { emails: visibleEmails },
      {
        enabled: visibleEmails.length > 0,
        staleTime: 60_000,
      }
    );

  const toggleStatus = trpc.admin.toggleUserStatus.useMutation({
    onSuccess: async (_data, vars) => {
      toast.success(`User ${vars.disabled ? 'disabled' : 'enabled'} successfully`);
      // Optimistically update the correct cache key
      utils.admin.listUsers.setData(undefined, (prev) =>
        prev
          ? prev.map((u) =>
              u.uid === vars.uid ? { ...u, disabled: vars.disabled } : u
            )
          : prev
      );
    },
    onError: (err) => {
      const code = (err as any)?.data?.code;
      const msg =
        code === 'FORBIDDEN'
          ? 'Access denied'
          : (err as any)?.message || 'Failed to update user status';
      toast.error(msg);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleUserStatus = async (u: FirebaseUser) => {
    if (!u.uid) {
      toast.error('Missing uid for this user entry');
      return;
    }
    const isAdmin = !!u.email && !!adminMap?.[u.email.toLowerCase()];
    if (isAdmin) {
      toast.error('Cannot disable admin accounts');
      return;
    }

    setLoadingUid(u.uid);
    try {
      await toggleStatus.mutateAsync({
        uid: u.uid,
        disabled: !u.disabled,
        email: u.email,
      });
    } finally {
      setLoadingUid(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      return (
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.uid || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">User Management</h2>
        </div>
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  if (isError) {
    if ((error as any)?.data?.code === 'FORBIDDEN') {
      return (
        <div className="p-6">
          <p className="text-destructive">Access denied. Admin privileges required.</p>
        </div>
      );
    }
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load users.</p>
      </div>
    );
  }

  const busy = adminMapLoading || toggleStatus.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by email, username, name, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh user list"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredUsers.length} user
          {filteredUsers.length !== 1 ? 's' : ''}
        </p>
      )}

      <div className="grid gap-3">
        {filteredUsers.map((u, idx) => {
          const key = u.uid ?? u.email ?? `row-${idx}`;
          const isAdmin = !!u.email && !!adminMap?.[u.email.toLowerCase()];
          const disabledLabel = u.disabled ? 'Disabled' : '';

          return (
            <Card key={key} className="hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base leading-tight">
                      {u.username || u.displayName || u.email || 'Unknown User'}
                    </CardTitle>
                    <CardDescription className="mt-1 space-y-0.5">
                      {u.email && <span className="block text-xs truncate">{u.email}</span>}
                      <span className="block text-xs text-muted-foreground truncate">{u.uid}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {isAdmin && (
                      <span className="px-2 py-0.5 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 rounded whitespace-nowrap">
                        Admin
                      </span>
                    )}
                    {u.disabled && (
                      <span className="px-2 py-0.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded whitespace-nowrap">
                        {disabledLabel}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground space-x-3">
                    {u.creationTime && (
                      <span>Created: {new Date(u.creationTime).toLocaleDateString()}</span>
                    )}
                    {u.lastSignInTime && (
                      <span>Last login: {new Date(u.lastSignInTime).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Button
                    variant={u.disabled ? 'default' : 'destructive'}
                    size="sm"
                    onClick={() => handleToggleUserStatus(u)}
                    disabled={busy || loadingUid === u.uid || isAdmin}
                    className="w-full sm:w-auto"
                  >
                    {busy
                      ? '...'
                      : isAdmin
                      ? 'Protected'
                      : loadingUid === u.uid
                      ? '...'
                      : u.disabled
                      ? 'Enable'
                      : 'Disable'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No users found matching your search.'
                : 'No users to display.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
