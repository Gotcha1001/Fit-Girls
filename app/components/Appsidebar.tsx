"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Compass,
  Heart,
  MessageCircle,
  Gift,
  PhoneCall,
  User,
  Settings,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/likes", label: "Likes", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/calls", label: "Call Requests", icon: PhoneCall },
  { href: "/gifts", label: "Gifts", icon: Gift },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/tokens", label: "Tokens", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar(): React.JSX.Element {
  const { user } = useUser();
  const pathname = usePathname();
  const likesCount = useQuery(api.likes.getLikesCount);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="text-2xl">💫</span>
          <div>
            <p className="text-sm font-black text-sidebar-foreground">
              <span className="text-rose-500">SPARK</span>
            </p>
            <p className="text-[10px] text-sidebar-foreground/60">
              Meet someone real
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={pathname === href}>
                  <Link href={href} className="flex items-center gap-2">
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
                {href === "/likes" &&
                  likesCount !== undefined &&
                  likesCount > 0 && (
                    <SidebarMenuBadge className="bg-rose-600 text-white">
                      {likesCount}
                    </SidebarMenuBadge>
                  )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <div className="px-3 py-2 border-t border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-sm">
                💫
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user.fullName ?? user.username}
                </p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
