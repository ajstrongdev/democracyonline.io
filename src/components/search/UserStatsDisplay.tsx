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
      value: stats.total_users || "...",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: UserCheck,
      label: "Active Users",
      value: stats.active_users || "...",
      color: "text-green-600 dark:text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      {statItems.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
