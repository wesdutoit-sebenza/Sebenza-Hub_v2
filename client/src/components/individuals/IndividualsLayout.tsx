import { Link, useLocation } from "wouter";
import { useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  User,
  FileText,
  Briefcase,
  ClipboardList,
  MessageCircle,
  CreditCard,
  Settings,
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  Search,
  Save,
  List,
  Heart,
} from "lucide-react";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  subItems?: {
    title: string;
    url: string;
    icon: any;
  }[];
}

const menuItems: MenuItem[] = [
  {
    title: "Profile",
    url: "/dashboard/individual/profile",
    icon: User,
  },
  {
    title: "CVs",
    url: "/dashboard/individual/cvs",
    icon: FileText,
  },
  {
    title: "Job Searches",
    icon: Briefcase,
    subItems: [
      {
        title: "All Jobs",
        url: "/dashboard/individual/jobs/all",
        icon: List,
      },
      {
        title: "Auto Job Search",
        url: "/dashboard/individual/jobs/auto",
        icon: Sparkles,
      },
      {
        title: "Manual Job Search",
        url: "/dashboard/individual/jobs/manual",
        icon: Search,
      },
      {
        title: "Saved Job Searches",
        url: "/dashboard/individual/jobs/saved",
        icon: Save,
      },
    ],
  },
  {
    title: "My Applications",
    icon: ClipboardList,
    subItems: [
      {
        title: "All Applications",
        url: "/dashboard/individual/applications",
        icon: ClipboardList,
      },
      {
        title: "My Favourite Jobs",
        url: "/dashboard/individual/favourites",
        icon: Heart,
      },
    ],
  },
  {
    title: "Take Competency Test",
    url: "/dashboard/individual/tests",
    icon: ClipboardCheck,
  },
  {
    title: "Coaching",
    url: "/dashboard/individual/coaching",
    icon: MessageCircle,
  },
  {
    title: "Billing",
    url: "/dashboard/individual/billing",
    icon: CreditCard,
  },
  {
    title: "Settings",
    url: "/dashboard/individual/settings",
    icon: Settings,
  },
];

interface IndividualsLayoutProps {
  children: React.ReactNode;
}

export function IndividualsLayout({ children }: IndividualsLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [openItems, setOpenItems] = useState<string[]>(["Job Searches", "My Applications"]);

  const toggleItem = (title: string) => {
    setOpenItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (url?: string) => {
    if (!url) return false;
    return location === url;
  };

  const isSubItemActive = (subItems?: { url: string }[]) => {
    if (!subItems) return false;
    return subItems.some(sub => location === sub.url);
  };

  const style = {
    "--sidebar-width": "18rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <Sidebar data-testid="individuals-sidebar">
          <SidebarContent className="pt-20">
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-semibold px-4 mb-4">
                Individual's Dashboard
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    item.subItems ? (
                      <Collapsible
                        key={item.title}
                        open={openItems.includes(item.title)}
                        onOpenChange={() => toggleItem(item.title)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isSubItemActive(item.subItems)}
                              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                              <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${openItems.includes(item.title) ? 'rotate-90' : ''}`} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isActive(subItem.url)}
                                  >
                                    <Link 
                                      href={subItem.url}
                                      data-testid={`link-${subItem.title.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                      <subItem.icon className="w-4 h-4" />
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    ) : (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)}>
                          <Link href={item.url!} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        
        <div className="flex flex-col flex-1">
          <header className="flex items-center h-16 px-4 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <h1 className="ml-4 text-lg font-semibold">Individual Dashboard</h1>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
