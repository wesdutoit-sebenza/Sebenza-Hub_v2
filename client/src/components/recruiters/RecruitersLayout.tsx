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
  User,
  Briefcase,
  Target,
  Users,
  Building2,
  ClipboardCheck,
  Calendar,
  CreditCard,
  Settings,
} from "lucide-react";

const menuItems = [
  {
    title: "Profile",
    url: "/dashboard/recruiter/profile",
    icon: User,
  },
  {
    title: "Corporate Clients",
    url: "/dashboard/recruiter/clients",
    icon: Building2,
  },
  {
    title: "Job Postings",
    url: "/dashboard/recruiter/jobs",
    icon: Briefcase,
  },
  {
    title: "Roles & Screenings",
    url: "/dashboard/recruiter/roles",
    icon: Target,
  },
  {
    title: "Candidate Database",
    url: "/dashboard/recruiter/candidates",
    icon: Users,
  },
  {
    title: "Competency Tests",
    url: "/dashboard/recruiter/tests",
    icon: ClipboardCheck,
  },
  {
    title: "Interview Scheduling",
    url: "/dashboard/recruiter/scheduling",
    icon: Calendar,
  },
  {
    title: "Billing",
    url: "/dashboard/recruiter/billing",
    icon: CreditCard,
  },
  {
    title: "Settings",
    url: "/dashboard/recruiter/settings",
    icon: Settings,
  },
];

interface RecruitersLayoutProps {
  children: React.ReactNode;
}

export function RecruitersLayout({ children }: RecruitersLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();

  // Development: Email verification check disabled
  // useEffect(() => {
  //   if (!loading && user && !user.emailVerified) {
  //     setLocation("/verify-email");
  //   }
  // }, [user, loading, setLocation]);

  const style = {
    "--sidebar-width": "18rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <Sidebar data-testid="recruiters-sidebar">
          <SidebarContent className="pt-20">
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-semibold px-4 mb-4">
                Recruiter's Dashboard
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
            <h1 className="ml-4 text-lg font-semibold">Recruiter Dashboard</h1>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
