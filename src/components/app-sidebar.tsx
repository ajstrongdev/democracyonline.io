"use client";

import * as React from "react";
import {
  User,
  Bell,
  Building2,
  Landmark,
  Crown,
  LogOut,
  Sun,
  Moon,
  Handshake,
  Newspaper,
  ChevronDown,
  ChartNoAxesCombined,
  MessageSquare,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { auth } from "@/lib/firebase";

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
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
      url: "/notifications",
      icon: Bell,
    },
    {
      title: "Political Parties",
      url: "/parties",
      icon: Handshake,
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = React.useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    setMounted(true);

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-4">
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
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                const isActive = pathname === item.url;
                if (item.dropdown) {
                  const isDropdownOpen = item.dropdown.some(
                    (sub) =>
                      pathname === sub.url || pathname.startsWith(sub.url)
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
                                href={sub.url}
                                isActive={pathname === sub.url}
                                size="sm"
                              >
                                <sub.icon size={16} />
                                <span>{sub.title}</span>
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
                      <a href={item.url} className="flex items-center gap-2">
                        <item.icon size={20} />
                        <span className="text-[15px]">{item.title}</span>
                      </a>
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
            <SidebarMenuButton onClick={toggleTheme}>
              {mounted ? theme === "dark" ? <Sun /> : <Moon /> : <Moon />}
              <span>Change theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {mounted && user ? (
              <SidebarMenuButton onClick={handleSignOut}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            ) : mounted ? (
              <SidebarMenuButton onClick={() => router.push("/sign-in")}>
                <Crown />
                <span>Sign in</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton disabled>
                <Crown />
                <span>Loading...</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
