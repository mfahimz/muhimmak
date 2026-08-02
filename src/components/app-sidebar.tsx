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
  ClockAlert,
  ChevronDown,
  QrCode,
} from "lucide-react"

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  roles: string[]
}

interface NavGroup {
  titleKey: string
  fallbackTitle: string
  items: NavItem[]
}

const TOP_NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "ceo", "agm", "manager", "receptionist"],
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
    title: "Daily QR",
    url: "/dashboard/daily-qr",
    icon: QrCode,
    roles: ["super_admin", "ceo", "agm", "manager", "receptionist"],
  },
]

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "navGroupAnalytics",
    fallbackTitle: "Analytics",
    items: [
      {
        title: "detailedReports",
        url: "/dashboard/reports",
        icon: ChartNoAxesCombined,
        roles: ["super_admin", "ceo", "agm", "manager"],
      },
    ],
  },
  {
    titleKey: "navGroupManage",
    fallbackTitle: "Manage",
    items: [
      {
        title: "Forms",
        url: "/dashboard/forms",
        icon: FileText,
        roles: ["super_admin", "ceo", "agm"],
      },
      {
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
        roles: ["super_admin", "ceo"],
      },
    ],
  },
  {
    titleKey: "navGroupAdmin",
    fallbackTitle: "Admin",
    items: [
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        roles: ["super_admin", "ceo"],
      },
    ],
  },
]

function CollapsibleNavGroup({
  group,
  userRole,
  pathname,
  t,
}: {
  group: NavGroup
  userRole: string
  pathname: string
  t: (key: string) => string
}) {
  const visibleItems = React.useMemo(() => {
    return group.items.filter((item) => item.roles.includes(userRole))
  }, [group.items, userRole])

  const isAnyItemActive = React.useMemo(() => {
    return visibleItems.some((item) =>
      item.url === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === item.url || pathname.startsWith(item.url + "/")
    )
  }, [visibleItems, pathname])

  const [isOpen, setIsOpen] = React.useState(isAnyItemActive)

  React.useEffect(() => {
    if (isAnyItemActive) {
      setIsOpen(true)
    }
  }, [isAnyItemActive])

  if (visibleItems.length === 0) return null

  return (
    <SidebarGroup className="py-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
      >
        <span>{t(group.titleKey)}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 text-slate-400 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {isOpen && (
        <SidebarGroupContent className="mt-1">
          <SidebarMenu className="gap-0.5 px-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.url === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.url || pathname.startsWith(item.url + "/")
              const translationKey =
                item.title === "detailedReports" ? "detailedReports" : `nav.${item.title}`

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
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

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

  const topItems = React.useMemo(() => {
    return TOP_NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  }, [user.role])

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
        <SidebarGroup className="pt-[20px] pb-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-1">
              {topItems.map((item) => {
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

        {NAV_GROUPS.map((group) => (
          <CollapsibleNavGroup
            key={group.titleKey}
            group={group}
            userRole={user.role}
            pathname={pathname}
            t={t}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 p-2 flex flex-col gap-2">
        <LanguageToggle />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
