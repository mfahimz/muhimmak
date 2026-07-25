"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Car } from "lucide-react"

export interface FormItem {
  id: string
  name: string
  description: string
  status: string
  type: string
}

interface NewSessionClientProps {
  activeForms: FormItem[]
  locationId: string | null
  userId?: string
  defaultFormId: string | null
}

export function NewSessionClient({ activeForms, locationId, defaultFormId }: NewSessionClientProps) {
  const router = useRouter()
  const t = useTranslations("Sessions")
  const [selectedFormId, setSelectedFormId] = React.useState<string>("")
  const [selectedLanguage, setSelectedLanguage] = React.useState<"en" | "ar">("en")
  const [plateNumber, setPlateNumber] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // Pre-select form based on defaultFormId if available and active, or auto-select first form if only one is available
  React.useEffect(() => {
    if (defaultFormId && activeForms.some((form) => form.id === defaultFormId)) {
      setSelectedFormId(defaultFormId)
    } else if (activeForms.length === 1) {
      setSelectedFormId(activeForms[0].id)
    }
  }, [activeForms, defaultFormId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFormId) {
      toast.error(t("errorSelectForm"))
      return
    }
    loading
    setLoading(true)

    try {
      const response = await fetch("/api/v1/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: selectedFormId,
          language: selectedLanguage,
          plateNumber: plateNumber.trim() || null,
          locationId: locationId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t("errorStartFailed"))
      }

      const data = await response.json()
      toast.success(t("successStarted"))
      router.push(`/survey/${data.sessionId}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t("errorStartFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border border-slate-200 shadow-xs dark:border-slate-800">
        <CardContent className="p-6 space-y-6">
          {/* Active Forms List */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("formLabel")} *
            </Label>
            {activeForms.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-rose-200 bg-rose-50/20 text-rose-600 text-xs font-semibold">
                {t("formEmpty")}
              </div>
            ) : (
              <Select value={selectedFormId} onValueChange={(val) => setSelectedFormId(val || "")}>
                <SelectTrigger className="h-11 border-slate-200 focus:ring-indigo-500 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                  <SelectValue placeholder={t("formPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {activeForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Language selection cards */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("languageLabel")} *
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <Card
                onClick={() => setSelectedLanguage("en")}
                className={`border transition-all p-4 text-center cursor-pointer select-none flex flex-col items-center justify-center gap-1 ${
                  selectedLanguage === "en"
                    ? "border-indigo-600 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20 shadow-xs"
                    : "border-slate-250 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{t("languageEnglish")}</span>
                <span className="text-[10px] text-slate-400">{t("languageEnglishDesc")}</span>
              </Card>

              <Card
                onClick={() => setSelectedLanguage("ar")}
                className={`border transition-all p-4 text-center cursor-pointer select-none flex flex-col items-center justify-center gap-1 ${
                  selectedLanguage === "ar"
                    ? "border-indigo-600 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20 shadow-xs"
                    : "border-slate-250 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{t("languageArabic")}</span>
                <span className="text-[10px] text-slate-400">{t("languageArabicDesc")}</span>
              </Card>
            </div>
          </div>

          {/* Plate number option (plaintext) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="plate-number" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Car className="size-4 text-slate-400" />
                <span>{t("plateLabel")}</span>
              </Label>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t("plateOptional")}</span>
            </div>
            <Input
              id="plate-number"
              type="text"
              autoComplete="off"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder={t("platePlaceholder")}
              className="h-11 border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 uppercase"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 h-10 px-5 rounded-xl"
        >
          {t("cancelButton")}
        </Button>
        <Button
          type="submit"
          disabled={loading || !selectedFormId || activeForms.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs flex items-center gap-1.5 h-10 px-6 rounded-xl"
        >
          {loading ? t("startingButton") : t("startButton")}
        </Button>
      </div>
    </form>
  )
}
