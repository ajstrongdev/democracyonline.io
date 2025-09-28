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
} from "lucide-react";
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
      title: "Notifications & Feed",
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
      title: "House of representatives",
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
          icon: Crown,
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
          icon: Crown,
        },
      ],
      url: "/oval-office",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
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
                <div className="flex items-center gap-2">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Crown className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="font-semibold">
                      Online Democratic Republic
                    </span>
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
                  // Dropdown menu item with chevron
                  return (
                    <SidebarMenuItem key={item.title}>
                      <details className="w-full group">
                        <summary className="flex items-center gap-2 cursor-pointer px-2 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronDown className="ml-auto transition-transform group-open:rotate-180" size={18} />
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
                    <SidebarMenuButton asChild isActive={isActive} className="px-2 py-2 rounded-md">
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
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
              <SidebarMenuButton onClick={() => router.push("/")}>
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
