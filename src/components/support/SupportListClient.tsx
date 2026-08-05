"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Inbox, ChevronDown, ChevronRight, Loader2, AlertCircle, Sparkles } from "lucide-react"

export interface SupportTicketItem {
  id: string
  raw_input: string
  structured: {
    title?: string
    description?: string
    steps_to_reproduce?: string
    severity?: string
    language_detected?: string
  } | null
  language_detected: string | null
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
  updated_at: string
  submitted_by_profile?: {
    full_name?: string
    role?: string
  } | null
}

interface SupportListClientProps {
  initialTickets: SupportTicketItem[]
}

export function SupportListClient({ initialTickets }: SupportListClientProps) {
  const t = useTranslations("Support")
  const [tickets, setTickets] = React.useState<SupportTicketItem[]>(initialTickets)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [updateError, setUpdateError] = React.useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId)
    setUpdateError(null)

    try {
      const response = await fetch(`/api/v1/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update ticket status")
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: newStatus as SupportTicketItem["status"], updated_at: new Date().toISOString() }
            : t
        )
      )
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-medium">
            {t("severityHigh")}
          </Badge>
        )
      case "medium":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-medium">
            {t("severityMedium")}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-medium">
            {t("severityLow")}
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-medium">
            {t("statusInProgress")}
          </Badge>
        )
      case "resolved":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium">
            {t("statusResolved")}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-medium">
            {t("statusOpen")}
          </Badge>
        )
    }
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Inbox className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {t("listTitle")}
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  {tickets.length} total tickets recorded
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {updateError && (
            <div className="m-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{updateError}</span>
            </div>
          )}

          {tickets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
              <Inbox className="size-12 stroke-[1.25] text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">No support tickets found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="w-10 px-4 py-3.5"></th>
                    <th className="px-4 py-3.5">{t("colTitle")}</th>
                    <th className="px-4 py-3.5">{t("colSeverity")}</th>
                    <th className="px-4 py-3.5">{t("colStatus")}</th>
                    <th className="px-4 py-3.5">{t("colSubmittedBy")}</th>
                    <th className="px-4 py-3.5 text-right">{t("colDate")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map((ticket) => {
                    const isExpanded = expandedId === ticket.id
                    const title = ticket.structured?.title || "Support Ticket"
                    const submitter = ticket.submitted_by_profile?.full_name || "Staff Member"
                    const formattedDate = new Date(ticket.created_at).toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })

                    return (
                      <React.Fragment key={ticket.id}>
                        <tr
                          onClick={() => toggleExpand(ticket.id)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span>{title}</span>
                              {ticket.language_detected === "ar" && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">
                                  AR
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">{getSeverityBadge(ticket.severity)}</td>
                          <td className="px-4 py-3.5">{getStatusBadge(ticket.status)}</td>
                          <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                            {submitter}
                          </td>
                          <td className="px-4 py-3.5 text-right text-xs text-slate-500 font-mono">
                            {formattedDate}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 border-t border-b border-indigo-100 dark:border-indigo-900/40">
                            <td colSpan={6} className="p-5">
                              <div className="space-y-4 max-w-4xl">
                                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    <Sparkles className="size-3.5" />
                                    <span>AI Structuring Breakdown</span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {t("updateStatus")}:
                                    </label>
                                    <div className="relative">
                                      <select
                                        value={ticket.status}
                                        disabled={updatingId === ticket.id}
                                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                        className="h-8 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      >
                                        <option value="open">{t("statusOpen")}</option>
                                        <option value="in_progress">{t("statusInProgress")}</option>
                                        <option value="resolved">{t("statusResolved")}</option>
                                      </select>
                                      {updatingId === ticket.id && (
                                        <Loader2 className="size-3.5 animate-spin absolute right-2 top-2 text-indigo-600" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs uppercase tracking-wider text-slate-400">
                                      {t("description")}
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {ticket.structured?.description || "Not available"}
                                    </p>
                                  </div>

                                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs uppercase tracking-wider text-slate-400">
                                      {t("stepsToReproduce")}
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {ticket.structured?.steps_to_reproduce || "Not provided"}
                                    </p>
                                  </div>
                                </div>

                                <div className="bg-slate-100/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 block">
                                    {t("rawInput")}
                                  </span>
                                  <p className="text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap">
                                    {ticket.raw_input}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
