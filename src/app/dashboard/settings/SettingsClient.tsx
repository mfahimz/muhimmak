"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LayoutGrid, ShieldCheck, Building2, BellRing, Info, Check, AlertTriangle, Loader2, Eye } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { NotificationSetting, NotificationEvent } from "@/server/services/notifications.service"

const RESOURCES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'forms', label: 'Forms' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'settings', label: 'Settings' },
  { id: 'users', label: 'Users' },
  { id: 'detailed_reports', label: 'Detailed Reports' },
];

const ROLES = ['receptionist', 'manager', 'agm', 'ceo'] as const;

const PERMISSIONS: Record<string, Record<string, {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_view_sensitive: boolean;
}>> = {
  receptionist: {
    dashboard: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    forms: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    sessions: { can_view: true, can_create: true, can_update: false, can_delete: false, can_view_sensitive: false },
    settings: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    users: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    detailed_reports: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
  },
  manager: {
    dashboard: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
    forms: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    sessions: { can_view: true, can_create: true, can_update: false, can_delete: false, can_view_sensitive: false },
    settings: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    users: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    detailed_reports: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
  },
  agm: {
    dashboard: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
    forms: { can_view: true, can_create: true, can_update: true, can_delete: true, can_view_sensitive: true },
    sessions: { can_view: true, can_create: true, can_update: false, can_delete: false, can_view_sensitive: true },
    settings: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    users: { can_view: false, can_create: false, can_update: false, can_delete: false, can_view_sensitive: false },
    detailed_reports: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
  },
  ceo: {
    dashboard: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
    forms: { can_view: true, can_create: true, can_update: true, can_delete: true, can_view_sensitive: true },
    sessions: { can_view: true, can_create: true, can_update: true, can_delete: true, can_view_sensitive: true },
    settings: { can_view: true, can_create: true, can_update: true, can_delete: true, can_view_sensitive: true },
    users: { can_view: true, can_create: true, can_update: true, can_delete: true, can_view_sensitive: true },
    detailed_reports: { can_view: true, can_create: false, can_update: false, can_delete: false, can_view_sensitive: true },
  },
};

const ROLE_LABELS: Record<string, string> = {
  receptionist: "roleReceptionist",
  manager: "roleManager",
  agm: "roleAgm",
  ceo: "roleCeo",
};

export interface FormType {
  id: string
  name: string
  description: string
  is_implemented: boolean
  enabled: boolean
  sort_order: number
}

export interface FacilitySettings {
  id: string
  google_review_url: string
  review_qr_threshold_percent: number
  ai_business_context?: string | null
  default_form_id?: string | null
}

interface SettingsClientProps {
  initialFormTypes: FormType[]
  initialFacilitySettings: FacilitySettings
  initialNotificationSettings: NotificationSetting[]
  activeForms: { id: string; name: string }[]
}

export function SettingsClient({
  initialFormTypes,
  initialFacilitySettings,
  initialNotificationSettings,
  activeForms,
}: SettingsClientProps) {
  const t = useTranslations("Settings")
  const [formTypes, setFormTypes] = React.useState<FormType[]>(initialFormTypes)
  const [googleReviewUrl, setGoogleReviewUrl] = React.useState(initialFacilitySettings.google_review_url)
  const [reviewQrThresholdPercent, setReviewQrThresholdPercent] = React.useState(initialFacilitySettings.review_qr_threshold_percent)
  const [aiBusinessContext, setAiBusinessContext] = React.useState(initialFacilitySettings.ai_business_context || "")
  const [defaultFormId, setDefaultFormId] = React.useState<string | null>(initialFacilitySettings.default_form_id || null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("form-types")

  const [notifSettings, setNotifSettings] = React.useState<NotificationSetting[]>(
    initialNotificationSettings || []
  )
  const [notifSaving, setNotifSaving] = React.useState<string | null>(null)
  const [notifError, setNotifError] = React.useState<string | null>(null)
  const [notifSuccess, setNotifSuccess] = React.useState<string | null>(null)
  const [recipientsInput, setRecipientsInput] = React.useState<Record<string, string>>({})

  async function saveNotifSetting(updated: NotificationSetting) {
    setNotifSaving(updated.event_type)
    setNotifError(null)
    setNotifSuccess(null)
    try {
      const res = await fetch("/api/v1/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      if (!res.ok) throw new Error("Failed to save")
      setNotifSettings((prev) => {
        const exists = prev.some((s) => s.event_type === updated.event_type)
        if (exists) {
          return prev.map((s) => (s.event_type === updated.event_type ? updated : s))
        }
        return [...prev, updated]
      })
      setNotifSuccess(updated.event_type)
      setTimeout(() => setNotifSuccess(null), 3000)
    } catch {
      setNotifError(updated.event_type)
    } finally {
      setNotifSaving(null)
    }
  }

  function getNotifSetting(event: NotificationEvent): NotificationSetting {
    const existing = notifSettings.find((s) => s.event_type === event)
    if (existing) return existing
    return {
      id: "",
      event_type: event,
      enabled: false,
      recipients: [],
      threshold_percent: event === "low_satisfaction_alert" ? 80 : null,
    }
  }

  function updateNotifSettingState(event: NotificationEvent, changes: Partial<NotificationSetting>) {
    setNotifSettings((prev) => {
      const exists = prev.some((s) => s.event_type === event)
      if (exists) {
        return prev.map((s) => (s.event_type === event ? { ...s, ...changes } : s))
      }
      const fallback = getNotifSetting(event)
      return [...prev, { ...fallback, ...changes }]
    })
  }

  function handleSaveCard(event: NotificationEvent) {
    const current = getNotifSetting(event)
    const rawRecipientsText = recipientsInput[event]
    const recipientsArray =
      rawRecipientsText !== undefined
        ? rawRecipientsText.split(",").map((e) => e.trim()).filter(Boolean)
        : current.recipients || []

    const updated: NotificationSetting = {
      ...current,
      recipients: recipientsArray,
    }
    saveNotifSetting(updated)
  }

  // Handle input changes
  const handleFieldChange = (id: string, field: keyof FormType, value: any) => {
    setFormTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  // Save changes to database
  const handleSaveFormTypes = async () => {
    setIsSaving(true)
    const supabase = createClient()

    try {
      // Run updates in parallel for modified types
      const promises = formTypes.map((item) => {
        // Find corresponding initial item to see if it changed
        const original = initialFormTypes.find((o) => o.id === item.id)
        if (
          original &&
          (original.name !== item.name ||
            original.description !== item.description ||
            original.enabled !== item.enabled)
        ) {
          return supabase
            .from("form_types")
            .update({
              name: item.name,
              description: item.description,
              enabled: item.enabled,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)
        }
        return Promise.resolve({ error: null })
      })

      const results = await Promise.all(promises)
      const errorResult = results.find((r) => r.error)

      if (errorResult?.error) {
        throw errorResult.error
      }

      toast.success(t("savedSuccess"))
    } catch (err: any) {
      console.error("Failed to save form types settings:", err)
      toast.error(t("errorSave") + `: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Save facility settings
  const handleSaveFacilitySettings = async () => {
    setIsSaving(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("facility_settings")
        .upsert({
          id: "00000000-0000-0000-0000-000000000000",
          google_review_url: googleReviewUrl,
          review_qr_threshold_percent: reviewQrThresholdPercent,
          ai_business_context: aiBusinessContext,
          default_form_id: defaultFormId || null,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      toast.success(t("savedSuccess"))
    } catch (err: any) {
      console.error("Failed to save facility settings:", err)
      toast.error(t("errorSave") + `: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
      {/* Navigation tabs sidebar */}
      <div className="md:col-span-1 flex flex-col gap-1">
        <button
          onClick={() => setActiveTab("form-types")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "form-types"
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/50"
          }`}
        >
          <LayoutGrid className="size-4" />
          <span>{t("formTypes")}</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "roles"
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/50"
          }`}
        >
          <ShieldCheck className="size-4" />
          <span>{t("rolesPermissions")}</span>
        </button>

        <button
          onClick={() => setActiveTab("facility")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "facility"
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/50"
          }`}
        >
          <Building2 className="size-4" />
          <span>{t("facilitySettings")}</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "notifications"
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/50"
          }`}
        >
          <BellRing className="size-4" />
          <span>{t("notifications")}</span>
        </button>
      </div>

      {/* Main settings panel content */}
      <div className="md:col-span-3">
        {activeTab === "form-types" && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("formTypes")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("formTypesDesc")}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {formTypes.map((item) => (
                  <div key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-4">
                    {/* Toggle and Meta Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          ID: {item.id}
                        </span>
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) => handleFieldChange(item.id, "name", e.target.value)}
                            className="h-8 text-sm font-bold border-transparent hover:border-slate-200 focus:border-indigo-500 hover:bg-slate-50/50 p-1 -ml-1 text-slate-900 dark:text-slate-100 max-w-[200px]"
                            required
                          />
                          {!item.is_implemented && (
                            <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-900 text-[10px] font-semibold hover:bg-slate-100 border-none px-1.5 py-0">
                              {t("comingSoon")}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Enabled Toggle Switch */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-semibold text-slate-500">
                            {t("enabled")}
                          </span>
                          <label
                            className={`relative inline-flex items-center select-none ${
                              item.is_implemented ? "cursor-pointer" : "cursor-not-allowed"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              disabled={!item.is_implemented}
                              onChange={(e) => handleFieldChange(item.id, "enabled", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 disabled:opacity-50"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Description Textarea */}
                    <div className="space-y-1">
                      <Label htmlFor={`desc-${item.id}`} className="text-xs font-semibold text-slate-500">
                        {t("description")}
                      </Label>
                      <textarea
                        id={`desc-${item.id}`}
                        value={item.description}
                        onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                        rows={2}
                        className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1.5 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                      />
                    </div>

                    {/* Unimplemented descriptive tooltip inline */}
                    {!item.is_implemented && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/10 p-2 rounded-lg border border-slate-100/50 dark:border-slate-900">
                        <Info className="size-3 text-slate-400" />
                        <span>{t("notAvailableYet")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-6">
                <Button
                  onClick={handleSaveFormTypes}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                >
                  {isSaving ? t("saving") : t("saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "roles" && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("rolesAndPermissions")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("rolesDescription")}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* Read-only warning info banner */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-xl p-4 flex items-center gap-3 text-xs font-medium">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{t("rolesReadOnlyNote")}</span>
              </div>

              {/* Matrix Table */}
              <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                        <th className="px-4 py-3 min-w-[140px]"></th>
                        <th className="px-3 py-3 text-center min-w-[70px]">{t("permView")}</th>
                        <th className="px-3 py-3 text-center min-w-[70px]">{t("permCreate")}</th>
                        <th className="px-3 py-3 text-center min-w-[70px]">{t("permUpdate")}</th>
                        <th className="px-3 py-3 text-center min-w-[70px]">{t("permDelete")}</th>
                        <th className="px-3 py-3 text-center min-w-[110px]">{t("permSensitive")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {ROLES.map((role) => (
                        <React.Fragment key={role}>
                          {/* Role Section Header Row */}
                          <tr className="bg-slate-100/70 dark:bg-slate-900/90 border-t border-b border-slate-200/80 dark:border-slate-800 font-bold">
                            <td colSpan={6} className="px-4 py-2.5 text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                              {t(ROLE_LABELS[role])}
                            </td>
                          </tr>
                          {/* Resource Rows under this Role */}
                          {RESOURCES.map((res) => {
                            const p = PERMISSIONS[role]?.[res.id]
                            return (
                              <tr key={`${role}-${res.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                <td className="px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-200">
                                  {res.label}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {p?.can_view ? (
                                    <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {p?.can_create ? (
                                    <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {p?.can_update ? (
                                    <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {p?.can_delete ? (
                                    <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {p?.can_view_sensitive ? (
                                    <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer note */}
              <p className="text-xs text-muted-foreground pt-1">
                {t("rolesSuperAdminNote")}
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "facility" && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("facilitySettings")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("facilitySubtitle")}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              <div className="space-y-4 text-start">
                <div className="space-y-2">
                  <Label htmlFor="google-review-url" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t("googleReviewLabel")}
                  </Label>
                  <Input
                    id="google-review-url"
                    type="url"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    placeholder="https://search.google.com/local/writereview?placeid=..."
                    required
                    className="h-10 border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-qr-threshold" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t("qrThresholdLabel")}
                  </Label>
                  <div className="flex items-center gap-2 max-w-[200px]">
                    <Input
                      id="review-qr-threshold"
                      type="number"
                      min={0}
                      max={100}
                      value={reviewQrThresholdPercent}
                      onChange={(e) => setReviewQrThresholdPercent(parseInt(e.target.value) || 0)}
                      required
                      className="h-10 border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 text-center"
                    />
                    <span className="text-sm text-slate-500 font-medium">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {t("qrThresholdDescription")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-form" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t("defaultFormLabel")}
                  </Label>
                  <Select value={defaultFormId || ""} onValueChange={(val) => setDefaultFormId(val || null)}>
                    <SelectTrigger id="default-form" className="h-10 border-slate-200 focus:ring-indigo-500 dark:border-slate-800 text-slate-900 dark:text-slate-100 w-full max-w-[300px]">
                      <SelectValue placeholder={t("defaultFormNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("defaultFormNone")}</SelectItem>
                      {activeForms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {t("defaultFormDescription")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-business-context" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t("aiContextLabel")}
                  </Label>
                  <textarea
                    id="ai-business-context"
                    value={aiBusinessContext}
                    onChange={(e) => setAiBusinessContext(e.target.value)}
                    rows={4}
                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                  />
                  <p className="text-xs text-muted-foreground leading-normal">
                    {t("aiContextDescription")}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-6">
                <Button
                  onClick={handleSaveFacilitySettings}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                >
                  {isSaving ? t("saving") : t("saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {t("notificationsTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("notificationsSubtitle")}
                  </CardDescription>
                </div>
                <Link
                  href="/dashboard/notifications/preview"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                >
                  <Eye className="size-3.5" />
                  Preview Templates
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* 3 Notification Cards */}
              <div className="space-y-6">
                {(["low_satisfaction_alert", "daily_summary", "weekly_summary"] as const).map(
                  (event) => {
                    const setting = getNotifSetting(event)
                    const isLowSat = event === "low_satisfaction_alert"

                    const titleKey =
                      event === "low_satisfaction_alert"
                        ? "notifLowSatTitle"
                        : event === "daily_summary"
                        ? "notifDailySummaryTitle"
                        : "notifWeeklySummaryTitle"

                    const descKey =
                      event === "low_satisfaction_alert"
                        ? "notifLowSatDesc"
                        : event === "daily_summary"
                        ? "notifDailySummaryDesc"
                        : "notifWeeklySummaryDesc"

                    const rawRecipientsText =
                      recipientsInput[event] !== undefined
                        ? recipientsInput[event]
                        : (setting.recipients || []).join(", ")

                    const isSavingThis = notifSaving === event
                    const isSuccessThis = notifSuccess === event
                    const isErrorThis = notifError === event

                    return (
                      <Card key={event} className="border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <CardHeader className="p-5 pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {t(titleKey)}
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground mt-1">
                                {t(descKey)}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {setting.enabled ? t("notifEnabled") : t("notifDisabled")}
                              </span>
                              <Switch
                                id={`switch-${event}`}
                                checked={setting.enabled}
                                onCheckedChange={(checked) =>
                                  updateNotifSettingState(event, { enabled: checked })
                                }
                              />
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 pt-0 space-y-4">
                          {/* Recipients text input */}
                          <div className="space-y-1.5">
                            <Label htmlFor={`recipients-${event}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {t("notifRecipientsLabel")}
                            </Label>
                            <Input
                              id={`recipients-${event}`}
                              type="text"
                              value={rawRecipientsText}
                              onChange={(e) =>
                                setRecipientsInput((prev) => ({
                                  ...prev,
                                  [event]: e.target.value,
                                }))
                              }
                              placeholder={t("notifRecipientsPlaceholder")}
                              className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100"
                            />
                          </div>

                          {/* Threshold number input for low_satisfaction_alert only */}
                          {isLowSat && (
                            <div className="space-y-1.5">
                              <Label htmlFor="threshold-percent" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {t("notifThresholdLabel")}
                              </Label>
                              <div className="flex items-center gap-2 max-w-[180px]">
                                <Input
                                  id="threshold-percent"
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={setting.threshold_percent ?? 80}
                                  onChange={(e) =>
                                    updateNotifSettingState(event, {
                                      threshold_percent: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 text-center"
                                />
                                <span className="text-xs text-slate-500 font-medium">%</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {t("notifThresholdDesc")}
                              </p>
                            </div>
                          )}

                          {/* Save Action & Feedback per card */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="text-xs font-medium">
                              {isSuccessThis && (
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <Check className="size-3.5" />
                                  {t("notifSaveSuccess")}
                                </span>
                              )}
                              {isErrorThis && (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {t("notifSaveError")}
                                </span>
                              )}
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleSaveCard(event)}
                              disabled={isSavingThis}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-8 px-3 shadow-xs"
                            >
                              {isSavingThis ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin me-1.5" />
                                  {t("saving")}
                                </>
                              ) : (
                                t("saveChanges")
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
