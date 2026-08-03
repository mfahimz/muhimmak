"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, CircleUserRoundIcon, LogOutIcon, Check, Loader2 } from "lucide-react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    role: string
    avatar?: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const locale = useLocale()
  const tUser = useTranslations("User")
  const tRoles = useTranslations("Roles")
  const [loggingOut, setLoggingOut] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    router.prefetch("/login")
  }, [router])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const res = await fetch("/api/v1/auth/logout", {
        method: "POST",
      })
      if (res.ok) {
        toast.success(tUser("logoutSuccess"), {
          description: tUser("redirectingToLogin"),
        })
        setShowOverlay(true)
        router.push("/login")
        router.refresh()
        return
      }
      toast.error("Logout failed. Please try again.")
      setLoggingOut(false)
    } catch (err) {
      console.error("Logout failed:", err)
      toast.error("Network error during logout.")
      setLoggingOut(false)
    }
  }

  // Format role label using translation keys with fallback
  const formatRole = (role: string) => {
    return tRoles.has(role) ? tRoles(role) : role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const avatarFallback = user.name.slice(0, 2).toUpperCase()

  return (
    <>
      {showOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md transition-opacity duration-300">
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full text-center mx-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative size-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 border border-dashed border-indigo-400/40 animate-[spin_10s_linear_infinite]" />
              <div className="size-12 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Check className="size-6 text-white stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">{tUser("logoutSuccess")}</h3>
              <p className="text-xs text-slate-400">
                {tUser("goodbye", { name: user.name })}
              </p>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-medium text-indigo-400">
              <Loader2 className="size-3.5 animate-spin text-indigo-400" />
              <span>{tUser("redirectingToLogin")}</span>
            </div>

            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-slate-100 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors p-2 h-12"
                />
              }
            >
              <Avatar className="size-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar || ""} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold">{avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate font-medium text-slate-900">{user.name}</span>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-slate-200/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 leading-none">
                    {formatRole(user.role)}
                  </span>
                </div>
              </div>
              <EllipsisVerticalIcon className="ms-auto size-4 text-slate-400 group-hover/menu-button:text-slate-600 transition-colors" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56"
              side={isMobile ? "bottom" : (locale === "ar" ? "left" : "right")}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatar || ""} alt={user.name} />
                      <AvatarFallback className="rounded-lg">{avatarFallback}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {formatRole(user.role)}
                        </span>
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <CircleUserRoundIcon />
                  {tUser("account")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? <Spinner size="sm" /> : <LogOutIcon />}
                <span>{loggingOut ? tUser("signingOut") : tUser("signOut")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
