import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCard {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

interface AdminStatsGridProps {
  stats: StatCard[];
}

export function AdminStatsGrid({ stats }: AdminStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              {stat.value}
            </div>
            {stat.description && (
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
