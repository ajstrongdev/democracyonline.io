"use client";

import { BillsStageView } from "@/components/BillsStageView";
import withAuth from "@/lib/withAuth";

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
