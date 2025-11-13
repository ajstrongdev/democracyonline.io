'use client';

import withAuth from '@/lib/withAuth';
import { BillsStageView } from '@/components/BillsStageView';

function SenateBillsPage() {
  return (
    <BillsStageView
      title="Senate"
      stage="Senate"
      voterRole="Senator"
      chatRoom="senate"
      showRepsList
      repsRoleForList="Senator"
    />
  );
}

export default withAuth(SenateBillsPage);
