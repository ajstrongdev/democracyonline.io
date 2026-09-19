import { createFileRoute } from "@tanstack/react-router";
import { ElectionsPage } from "@/components/election-page";
import { electionPageData } from "@/lib/server/elections";
import { getCurrentUserInfo } from "@/lib/server/users";

export const Route = createFileRoute("/dashboard/elections/participate")({
  loader: async () => {
    const userData = await getCurrentUserInfo();
    const [president, senate] = await Promise.all([
      electionPageData({
        data: { election: "President", userId: userData?.id },
      }),
      electionPageData({
        data: { election: "Senate", userId: userData?.id },
      }),
    ]);
    return { userData, president, senate };
  },
  component: Elections,
});

function Elections() {
  const { userData, president, senate } = Route.useLoaderData();
  return (
    <ElectionsPage userData={userData} president={president} senate={senate} />
  );
}
