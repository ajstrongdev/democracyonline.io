import { UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface UserStatsProps {
  stats: Record<string, string>;
}

export function UserStatsDisplay({ stats }: UserStatsProps) {
  const statItems = [
    {
      icon: Users,
      label: "Total Users",
      value: stats.total_users || "0",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      icon: UserCheck,
      label: "Active Users",
      value: stats.active_users || "0",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {statItems.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="flex items-center gap-4">
              <div className={`${stat.bgColor} p-3 rounded-lg`}>
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
