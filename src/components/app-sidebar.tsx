"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { NavUser } from "@/components/nav-user"
import { LanguageToggle } from "@/components/language-toggle"
import { useTranslations } from "next-intl"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import Image from "next/image"
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  FileText,
  ClipboardList,
  Users,
  Settings,
  PlusIcon,
  ClockAlert,
} from "lucide-react"

const ALL_NAV_ITEMS = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "ceo", "agm", "manager", "receptionist"],
  },
  {
    title: "detailedReports",
    url: "/dashboard/reports",
    icon: ChartNoAxesCombined,
    roles: ["super_admin", "ceo", "agm", "manager"],
  },
  {
    title: "Forms",
    url: "/dashboard/forms",
    icon: FileText,
    roles: ["super_admin", "ceo", "agm"],
  },
  {
    title: "Sessions",
    url: "/dashboard/sessions",
    icon: ClipboardList,
    roles: ["super_admin", "ceo", "agm", "manager", "receptionist"],
  },
  {
    title: "Pending Closures",
    url: "/dashboard/pending-closures",
    icon: ClockAlert,
    roles: ["super_admin", "ceo", "agm", "manager", "receptionist"],
  },
  {
    title: "Users",
    url: "/dashboard/users",
    icon: Users,
    roles: ["super_admin", "ceo"],
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
    roles: ["super_admin", "ceo"],
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    role: string
    email: string
    avatar?: string
  }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations("Sidebar")

  // Filter items based on user's role
  const navItems = React.useMemo(() => {
    return ALL_NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  }, [user.role])

  const canStartSession =
    user.role === "receptionist" || user.role === "super_admin" || user.role === "ceo"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-slate-200 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="flex size-8 items-center justify-center rounded-lg bg-transparent relative">
                <Image
                  src="/brand/al-maraghi-icon-black.png"
                  alt={t("logoAlt")}
                  width={32}
                  height={32}
                  className="block dark:hidden object-contain"
                />
                <Image
                  src="/brand/al-maraghi-icon-white.png"
                  alt={t("logoAlt")}
                  width={32}
                  height={32}
                  className="hidden dark:block object-contain"
                />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-bold tracking-tight text-foreground">{t("brandTitle")}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {t("brandSubtext")}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {canStartSession && (
          <SidebarGroup className="pb-0 pt-4 px-3">
            <SidebarGroupContent>
              <Link href="/dashboard/sessions/new" className="w-full">
                <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-indigo-500 active:scale-98">
                  <PlusIcon className="size-4" />
                  <span>{t("startSession")}</span>
                </button>
              </Link>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="pt-[20px]">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.url || pathname.startsWith(item.url + "/")
                const translationKey = item.title === "detailedReports" ? "detailedReports" : `nav.${item.title}`

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={t(translationKey)}
                      className={`w-full justify-start h-9 px-3 gap-[10px] rounded-lg text-sm transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-50 text-indigo-600 font-semibold hover:bg-indigo-50 hover:text-indigo-600"
                          : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className={`transition-colors ${
                          isActive
                            ? "text-indigo-600"
                            : "text-slate-400 group-hover/menu-button:text-slate-600"
                        }`}
                      />
                      <span>{t(translationKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 p-2 flex flex-col gap-2">
        <LanguageToggle />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
