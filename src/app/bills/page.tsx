'use client';

import React, { useMemo, useState } from 'react';
import withAuth from '@/lib/withAuth';
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { trpc } from '@/lib/trpc';
import GenericSkeleton from '@/components/genericskeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Filter, X, Check, User, Landmark, Building2, Crown, Pencil } from 'lucide-react';

type Stage = 'House' | 'Senate' | 'Presidential';

function BillsPage() {
  const [user] = useAuthState(auth);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Queued' | 'Voting' | 'Passed' | 'Defeated'>('all');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'mine'>('all');

  // Current user (to support "My Bills" filter)
  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  // All bills
  const { data: bills = [], isLoading, error } = trpc.bill.listAll.useQuery();

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!bills) return [];
    return bills.filter((b: any) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesStage = stageFilter === 'all' || b.stage === stageFilter;
      const matchesCreator = creatorFilter === 'all' || (creatorFilter === 'mine' && thisUser?.id === b.creator_id);
      return matchesStatus && matchesStage && matchesCreator;
    });
  }, [bills, statusFilter, stageFilter, creatorFilter, thisUser]);

  // Prepare bill IDs for each stage totals fetch
  const houseIds = useMemo(() => filtered.map((b: any) => b.id), [filtered]);
  const senateIds = useMemo(() => filtered.filter((b: any) => b.stage !== 'House').map((b: any) => b.id), [filtered]);
  const presidentialIds = useMemo(
    () => filtered.filter((b: any) => b.stage === 'Presidential').map((b: any) => b.id),
    [filtered],
  );

  // Fetch totals with the same batched method used in BillsStageView
  const { data: houseVotes } = trpc.bill.getVotesForBills.useQuery(
    { stage: 'House', billIds: houseIds },
    { enabled: houseIds.length > 0 },
  );

  const { data: senateVotes } = trpc.bill.getVotesForBills.useQuery(
    { stage: 'Senate', billIds: senateIds },
    { enabled: senateIds.length > 0 },
  );

  const { data: presidentialVotes } = trpc.bill.getVotesForBills.useQuery(
    { stage: 'Presidential', billIds: presidentialIds },
    { enabled: presidentialIds.length > 0 },
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Bills</h1>
        <p className="text-muted-foreground">View and track the status of bills.</p>
        <Button asChild className="mt-4 hover:cursor-pointer">
          <Link href="/bills/create">Create New Bill</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          <FilterPill
            active={statusFilter === 'Passed'}
            onClick={() => setStatusFilter(statusFilter === 'Passed' ? 'all' : 'Passed')}
            icon={<Check size={18} />}
            activeClass="bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300"
            label="Passed"
          />
          <FilterPill
            active={statusFilter === 'Defeated'}
            onClick={() => setStatusFilter(statusFilter === 'Defeated' ? 'all' : 'Defeated')}
            icon={<X size={18} />}
            activeClass="bg-red-100 dark:bg-red-900/40 border-red-500 text-red-700 dark:text-red-300"
            label="Defeated"
          />
          <FilterPill
            active={statusFilter === 'Voting'}
            onClick={() => setStatusFilter(statusFilter === 'Voting' ? 'all' : 'Voting')}
            icon={<Filter size={18} />}
            activeClass="bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500 text-yellow-700 dark:text-yellow-300"
            label="Voting"
          />
          <FilterPill
            active={statusFilter === 'Queued'}
            onClick={() => setStatusFilter(statusFilter === 'Queued' ? 'all' : 'Queued')}
            icon={<Filter size={18} />}
            activeClass="bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-700 dark:text-slate-200"
            label="Queued"
          />

          {/* Stage */}
          <FilterPill
            active={stageFilter === 'House'}
            onClick={() => setStageFilter(stageFilter === 'House' ? 'all' : 'House')}
            icon={<Building2 size={18} />}
            activeClass="bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300"
            label="House"
          />
          <FilterPill
            active={stageFilter === 'Senate'}
            onClick={() => setStageFilter(stageFilter === 'Senate' ? 'all' : 'Senate')}
            icon={<Landmark size={18} />}
            activeClass="bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-700 dark:text-purple-300"
            label="Senate"
          />
          <FilterPill
            active={stageFilter === 'Presidential'}
            onClick={() =>
              setStageFilter(stageFilter === 'Presidential' ? 'all' : 'Presidential')
            }
            icon={<Crown size={18} />}
            activeClass="bg-amber-100 dark:bg-amber-900/40 border-amber-500 text-amber-700 dark:text-amber-300"
            label="Presidential"
          />

          {/* Creator */}
          <FilterPill
            active={creatorFilter === 'mine'}
            onClick={() => setCreatorFilter(creatorFilter === 'mine' ? 'all' : 'mine')}
            icon={<User size={18} />}
            activeClass="bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300"
            label="My Bills"
          />
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          All Bills
          <span className="text-lg font-normal text-muted-foreground ml-2">
            ({filtered.length} {filtered.length === 1 ? 'bill' : 'bills'})
          </span>
        </h1>

        {isLoading ? (
          <Card>
            <CardContent>
              <GenericSkeleton />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent>
              <p className="text-red-500">Error loading bills.</p>
            </CardContent>
          </Card>
        ) : filtered.length > 0 ? (
          filtered.map((bill: any) => {
            // Map totals from our batched results
            const house = houseVotes?.[bill.id];
            const senate = senateVotes?.[bill.id];
            const presidential = presidentialVotes?.[bill.id];

            return (
              <Card key={bill.id} id={bill.id} className="mb-4 last:mb-0">
                <CardContent>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-xl font-semibold">
                        Bill #{bill.id}: {bill.title}
                      </h2>
                      {thisUser.id === bill.creator_id && bill.status === 'Queued' && (
                        <Link href={`/bills/edit/${bill.id}`}>
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Pencil size={16} />
                            Edit
                          </Button>
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Proposed By: <b className="text-black dark:text-white">{bill.username}</b> | Status:{' '}
                      {bill.status} | Stage: {bill.stage} | Created at:{' '}
                      {new Date(bill.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-foreground mt-5 sm:mt-3 whitespace-pre-wrap">{bill.content}</p>

                    <div className="grid lg:grid-cols-3 grid-cols-1 mt-3">
                      <BillTotals
                        label="House"
                        yes={house?.for ?? 0}
                        no={house?.against ?? 0}
                      />
                      {bill.stage !== 'House' && (
                        <BillTotals
                          label="Senate"
                          yes={senate?.for ?? 0}
                          no={senate?.against ?? 0}
                        />
                      )}
                      {bill.stage === 'Presidential' && (
                        <BillTotals
                          label="Presidential"
                          yes={presidential?.for ?? 0}
                          no={presidential?.against ?? 0}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent>
              <p>
                No bills found
                {statusFilter !== 'all' || stageFilter !== 'all' || creatorFilter !== 'all'
                  ? ' matching the selected filters.'
                  : '.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function BillTotals({ label, yes, no }: { label: string; yes?: number; no?: number }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">{label}</h2>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded">
          Votes For: {yes ?? 0}
        </span>
        <span className="font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded">
          Votes Against: {no ?? 0}
        </span>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
        active ? activeClass : 'bg-card hover:bg-accent'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

export default withAuth(BillsPage);
