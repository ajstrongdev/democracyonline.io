import { Users } from "lucide-react";
import type { Candidate } from "@/lib/server/elections";
import { Badge } from "@/components/ui/badge";

export function CandidateAffiliationBadges({
  candidate,
}: {
  candidate: Candidate;
}) {
  return (
    <>
      <Badge variant="outline" className="gap-1.5 text-[10px] uppercase">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: candidate.partyColor ?? "currentColor" }}
        />
        {candidate.partyName ?? "Independent"}
      </Badge>
      {candidate.coalitionName && (
        <Badge variant="secondary" className="gap-1.5 text-[10px] uppercase">
          <Users className="h-3 w-3" />
          <span
            className="h-2 w-2 rounded-sm"
            style={{
              backgroundColor: candidate.coalitionColor ?? "currentColor",
            }}
          />
          {candidate.coalitionName}
        </Badge>
      )}
    </>
  );
}
