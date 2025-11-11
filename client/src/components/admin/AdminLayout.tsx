import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Building2,
  User,
  FileText,
  AlertTriangle,
  Target,
} from "lucide-react";

const menuItems = [
  {
    title: "Overview",
    url: "/admin/overview",
    icon: LayoutDashboard,
  },
  {
    title: "Recruiters",
    url: "/admin/recruiters",
    icon: Briefcase,
  },
  {
    title: "Businesses",
    url: "/admin/businesses",
    icon: Building2,
  },
  {
    title: "Individuals",
    url: "/admin/individuals",
    icon: User,
  },
  {
    title: "Candidates",
    url: "/admin/candidates",
    icon: Users,
  },
  {
    title: "Roles & Screening",
    url: "/admin/roles",
    icon: Target,
  },
  {
    title: "CV Ingestion",
    url: "/admin/cvs",
    icon: FileText,
  },
  {
    title: "Fraud Detection",
    url: "/admin/fraud",
    icon: AlertTriangle,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();

  // Development: Email verification check disabled
  // useEffect(() => {
  //   if (!loading && user && !user.emailVerified) {
  //     setLocation("/verify-email");
  //   }
  // }, [user, loading, setLocation]);

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <Sidebar data-testid="admin-sidebar">
          <SidebarContent className="pt-20">
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-semibold px-4 mb-4">
                Admin Dashboard
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        
        <div className="flex flex-col flex-1">
          <header className="flex items-center h-16 px-4 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <h1 className="ml-4 text-lg font-semibold">Admin Dashboard</h1>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
