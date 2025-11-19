"use client";

import { BillsStageView } from "@/components/BillsStageView";
import withAuth from "@/lib/withAuth";

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
