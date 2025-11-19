"use client";

import { BillsStageView } from "@/components/BillsStageView";
import withAuth from "@/lib/withAuth";

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
