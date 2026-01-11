import * as React from "react";
import {
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  Crown,
  Handshake,
  Landmark,
  LogOut,
  MessageSquare,
  Newspaper,
  Notebook,
  Search,
  Shield,
  User,
} from "lucide-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ModeToggle } from "./theme-toggle";
import { Logo } from "@/components/logo";
import { logOut } from "@/lib/auth-utils";
import { useAuth } from "@/lib/auth-context";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "Profile",
      url: "/profile",
      icon: User,
    },
    {
      title: "Feed",
      url: "/feed",
      icon: Bell,
    },
    {
      title: "Find Users",
      url: "/search",
      icon: Search,
    },
    {
      title: "Political Parties",
      icon: Handshake,
      url: "/parties",
    },
    {
      title: "Bills",
      url: "/bills",
      icon: Newspaper,
    },
    {
      title: "House of Representatives",
      icon: Building2,
      dropdown: [
        {
          title: "Bills",
          url: "/house-of-representatives/bills",
          icon: Newspaper,
        },
      ],
      url: "/house-of-representatives",
    },
    {
      title: "Senate",
      icon: Landmark,
      dropdown: [
        {
          title: "Bills",
          url: "/senate/bills",
          icon: Newspaper,
        },
        {
          title: "Elections",
          url: "/senate/elections",
          icon: ChartNoAxesCombined,
        },
      ],
      url: "/senate",
    },
    {
      title: "Oval Office",
      icon: Crown,
      dropdown: [
        {
          title: "Bills",
          url: "/oval-office/bills",
          icon: Newspaper,
        },
        {
          title: "Elections",
          url: "/oval-office/elections",
          icon: ChartNoAxesCombined,
        },
      ],
      url: "/oval-office",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [mounted, setMounted] = React.useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const ALLOWED_ADMIN_EMAILS = [
    "jenewland1999@gmail.com",
    "ajstrongdev@pm.me",
    "robertjenner5@outlook.com",
    "spam@hpsaucii.dev",
  ];

  const isAdmin = user?.email && ALLOWED_ADMIN_EMAILS.includes(user.email);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await logOut();
      router.navigate({ to: "/" });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" className="flex items-center gap-4">
                <Logo />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <p className="font-bold">
                    <span className="text-primary dark:text-[#44efa7]">
                      democracy
                    </span>
                    <span className="text-[#3b82f6] dark:text-[#60a5fa]">
                      online
                    </span>
                    .io
                  </p>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className={user ? "" : "hidden"}>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                const isActive = pathname === item.url;
                if (item.dropdown) {
                  const isDropdownOpen = item.dropdown.some(
                    (sub) =>
                      pathname === sub.url || pathname.startsWith(sub.url),
                  );
                  return (
                    <SidebarMenuItem key={item.title}>
                      <details className="w-full group" open={isDropdownOpen}>
                        <summary className="flex items-center gap-2 cursor-pointer px-2 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-[15px]">
                          <item.icon size={20} />
                          <span className="text-[15px]">{item.title}</span>
                          <ChevronDown
                            className="ml-auto transition-transform group-open:rotate-180"
                            size={20}
                          />
                        </summary>
                        <SidebarMenuSub>
                          {item.dropdown.map((sub) => (
                            <SidebarMenuSubItem key={sub.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === sub.url}
                                size="sm"
                              >
                                <Link to={sub.url as any}>
                                  <sub.icon size={16} />
                                  <span>{sub.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </details>
                    </SidebarMenuItem>
                  );
                }
                // Regular menu item, same size as dropdown headers
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="px-2 py-2 rounded-md text-[15px]"
                    >
                      <Link
                        to={item.url as any}
                        className="flex items-center gap-2"
                      >
                        <item.icon size={20} />
                        <span className="text-[15px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />

        <SidebarMenu>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/admin"}
                className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold"
              >
                <Link to="/admin" className="flex items-center gap-2">
                  <Shield />
                  <span>Admin Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() =>
                window.open("https://discord.gg/m7gDfgJund", "_blank")
              }
            >
              <MessageSquare />
              <span>Discord</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/releases"}>
              <Link to="/releases" className="flex items-center gap-2">
                <Notebook />
                <span>Releases</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            {user ? (
              <SidebarMenuButton onClick={handleSignOut}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            ) : mounted ? (
              <SidebarMenuButton asChild>
                <Link to="/login" className="flex items-center gap-2">
                  <Crown />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
