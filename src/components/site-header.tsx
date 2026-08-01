import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTranslations } from "next-intl"
import { NotificationBell } from "@/components/dashboard/NotificationBell"

export function SiteHeader({ title }: { title?: string }) {
  const t = useTranslations("Header")
  const displayTitle = title || t("dashboard")

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto"
          />
          <h1 className="text-base font-medium">{displayTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
