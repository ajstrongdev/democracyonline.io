'use client';

import withAuth from '@/lib/withAuth';
import { BillsStageView } from '@/components/BillsStageView';

function OvalBillsPage() {
  return (
    <BillsStageView
      title="Oval Office"
      stage="Presidential"
      voterRole="President"
      chatRoom="oval-office"
      showRepsList
      repsRoleForList="President"
    />
  );
}

export default withAuth(OvalBillsPage);
