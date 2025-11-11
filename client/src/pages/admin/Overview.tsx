import { useQuery } from "@tanstack/react-query";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, Building2, User, Target, AlertTriangle, FileCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AdminStats {
  users: number;
  recruiters: number;
  businesses: number;
  individuals: number;
  candidates: number;
  activeRoles: number;
  screenings: number;
  pendingFlags: number;
}

interface Activity {
  recentUsers: Array<{ id: string; email: string; createdAt: string; roles: string[] }>;
  recentCandidates: Array<{ id: string; name: string; createdAt: string }>;
  recentRoles: Array<{ id: string; title: string; createdAt: string; organizationId: string }>;
}

export default function AdminOverview() {
  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: activity, isLoading: loadingActivity } = useQuery<Activity>({
    queryKey: ['/api/admin/activity'],
  });

  const statCards = [
    {
      title: "Total Users",
      value: stats?.users || 0,
      icon: Users,
      description: "Registered accounts",
    },
    {
      title: "Recruiters",
      value: stats?.recruiters || 0,
      icon: Briefcase,
      description: "Verified recruiters",
    },
    {
      title: "Businesses",
      value: stats?.businesses || 0,
      icon: Building2,
      description: "Organizations",
    },
    {
      title: "Individuals",
      value: stats?.individuals || 0,
      icon: User,
      description: "Candidate profiles",
    },
    {
      title: "ATS Candidates",
      value: stats?.candidates || 0,
      icon: Users,
      description: "In system",
    },
    {
      title: "Active Roles",
      value: stats?.activeRoles || 0,
      icon: Target,
      description: "Open positions",
    },
    {
      title: "Screenings",
      value: stats?.screenings || 0,
      icon: FileCheck,
      description: "Completed evaluations",
    },
    {
      title: "Pending Flags",
      value: stats?.pendingFlags || 0,
      icon: AlertTriangle,
      description: "Need review",
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="page-admin-overview">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and recent activity</p>
      </div>

      <AdminStatsGrid stats={statCards} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
            <CardDescription>Latest 10 registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activity?.recentUsers && activity.recentUsers.length > 0 ? (
              <div className="space-y-3">
                {activity.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between" data-testid={`recent-user-${user.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(user.createdAt), 'PPp')}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Badge variant="secondary" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent users</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Candidates</CardTitle>
            <CardDescription>Latest 10 additions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activity?.recentCandidates && activity.recentCandidates.length > 0 ? (
              <div className="space-y-3">
                {activity.recentCandidates.map((candidate) => (
                  <div key={candidate.id} data-testid={`recent-candidate-${candidate.id}`}>
                    <p className="text-sm font-medium">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(candidate.createdAt), 'PPp')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent candidates</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Roles</CardTitle>
            <CardDescription>Latest 10 job postings</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activity?.recentRoles && activity.recentRoles.length > 0 ? (
              <div className="space-y-3">
                {activity.recentRoles.map((role) => (
                  <div key={role.id} data-testid={`recent-role-${role.id}`}>
                    <p className="text-sm font-medium">{role.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(role.createdAt), 'PPp')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent roles</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
