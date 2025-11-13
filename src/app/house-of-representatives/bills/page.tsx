'use client';

import withAuth from '@/lib/withAuth';
import { BillsStageView } from '@/components/BillsStageView';

function HouseBillsPage() {
  return (
    <BillsStageView
      title="House of Representatives"
      stage="House"
      voterRole="Representative"
      chatRoom="house"
      showRepsList
      repsRoleForList="Representative"
    />
  );
}

export default withAuth(HouseBillsPage);
