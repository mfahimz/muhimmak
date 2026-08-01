"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Globe, Car, Phone, AlertCircle, CheckCircle2, ShieldAlert, Loader2, LogIn, LogOut } from "lucide-react"
import { SurveyClient, SurveySession } from "@/app/survey/[id]/SurveyClient"
import { createClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PublicFeedbackClientProps {
  form: {
    id: string
    name: string
    description: string
    fields: any
    is_visit_journey?: boolean
  }
  facilitySettings: {
    google_review_url: string
    review_qr_threshold_percent: number
  }
  initialLocale: "en" | "ar"
}

export function PublicFeedbackClient({
  form,
  facilitySettings,
  initialLocale,
}: PublicFeedbackClientProps) {
  const router = useRouter()
  const [locale, setLocale] = React.useState<"en" | "ar">(initialLocale)
  const [currentStep, setCurrentStep] = React.useState<"language" | "details" | "stage" | "duplicate" | "survey">("language")

  // Customer Input State
  const [plateCategories, setPlateCategories] = React.useState<{ emirate: string; emirate_ar: string; code: string }[]>([])
  const [selectedEmirate, setSelectedEmirate] = React.useState<string>("")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("")
  const [plateDigits, setPlateDigits] = React.useState<string>("")
  const [mobileNumber, setMobileNumber] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Fetch plate categories on mount
  React.useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("plate_categories")
        .select("emirate, emirate_ar, code")
        .eq("is_active", true)
        .order("emirate", { ascending: true })
        .order("sort_order", { ascending: true })

      if (error) {
        console.error("Failed to fetch plate categories:", error)
      } else if (data) {
        setPlateCategories(data)
      }
    }
    fetchCategories()
  }, [])

  // Derive unique emirates
  const uniqueEmirates = React.useMemo(() => {
    const seen = new Set<string>()
    const list: { emirate: string; emirate_ar: string }[] = []
    for (const cat of plateCategories) {
      if (!seen.has(cat.emirate)) {
        seen.add(cat.emirate)
        list.push({
          emirate: cat.emirate,
          emirate_ar: cat.emirate_ar,
        })
      }
    }
    return list
  }, [plateCategories])

  // Filter categories by selected emirate
  const filteredCategories = React.useMemo(() => {
    if (!selectedEmirate) return []
    return plateCategories.filter(cat => cat.emirate === selectedEmirate)
  }, [selectedEmirate, plateCategories])

  // Reset category when emirate changes
  const handleEmirateChange = (val: string | null) => {
    setSelectedEmirate(val || "")
    setSelectedCategory("")
  }

  // Filter digits input
  const handleDigitsChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 5)
    setPlateDigits(digitsOnly)
  }

  // Assemble plate number format
  const plateNumber = React.useMemo(() => {
    if (!selectedEmirate || !selectedCategory || !plateDigits) return ""
    const cleanDigits = plateDigits.trim()
    const cleanCategory = selectedCategory.trim()

    switch (selectedEmirate) {
      case "Abu Dhabi":
        return `${cleanDigits}-R${cleanCategory}`
      case "Dubai":
        return `${cleanDigits}DXB-${cleanCategory}`
      case "Sharjah":
        return `${cleanDigits}SHJ-${cleanCategory}`
      case "Ajman":
        return `${cleanDigits}AJM-${cleanCategory}`
      case "Umm Al Quwain":
        return `${cleanDigits}UAQ-${cleanCategory}`
      case "Fujairah":
        return `${cleanDigits}FUJ-${cleanCategory}`
      case "Ras Al Khaimah":
        return `${cleanDigits}RAK-${cleanCategory}`
      default:
        return `${cleanDigits}-${cleanCategory}`
    }
  }, [selectedEmirate, selectedCategory, plateDigits])
  const [submitting, setSubmitting] = React.useState(false)

  // Duplicate Dispute State
  const [disputeNotified, setDisputeNotified] = React.useState(false)
  const [notifyingDispute, setNotifyingDispute] = React.useState(false)

  // Active Session State for Step 3
  const [session, setSession] = React.useState<SurveySession | null>(null)

  const isArabic = locale === "ar"

  // Step 1: Language selection helper
  const handleSelectLanguage = (selectedLang: "en" | "ar") => {
    setLocale(selectedLang)
    document.cookie = `NEXT_LOCALE=${selectedLang}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
    setCurrentStep("details")
  }

  // Language toggle for step 2
  const handleToggleLanguage = (newLang: "en" | "ar") => {
    if (newLang === locale) return
    setLocale(newLang)
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
  }

  // Session creation helper
  const handleCreateSession = async (stage: "drop_off" | "pick_up" | null) => {
    setErrorMsg(null)
    setSubmitting(true)

    const cleanPlate = plateNumber.trim().toUpperCase()
    try {
      const res = await fetch("/api/v1/public/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: cleanPlate,
          mobileNumber: mobileNumber.trim(),
          language: locale,
          visitStage: stage,
        }),
      })

      const data = await res.json()

      if (res.status === 409 || data.duplicate) {
        setCurrentStep("duplicate")
        return
      }

      if (!res.ok) {
        throw new Error(data.error || (isArabic ? "فشل إنشاء الجلسة" : "Failed to start session"))
      }

      if (data.session) {
        setSession(data.session)
        setCurrentStep("survey")
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isArabic ? "حدث خطأ غير متوقع" : "An unexpected error occurred"))
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2: Details submission handler
  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanPlate = plateNumber.trim().toUpperCase()
    if (!cleanPlate || cleanPlate.length < 2) {
      setErrorMsg(
        isArabic
          ? "يرجى إدخال رقم لوحة المركبة بشكل صحيح."
          : "Please enter a valid vehicle plate number."
      )
      return
    }

    if (form.is_visit_journey) {
      setCurrentStep("stage")
    } else {
      await handleCreateSession(null)
    }
  }

  // Dispute notification action
  const handleNotifyStaffDispute = async () => {
    setNotifyingDispute(true)
    try {
      await fetch("/api/v1/public/notify-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: plateNumber.trim().toUpperCase() }),
      })
      setDisputeNotified(true)
    } catch (err) {
      console.error(err)
    } finally {
      setNotifyingDispute(false)
    }
  }

  const renderFooter = () => (
    <div className="w-full max-w-md mt-6 space-y-4 text-center select-none" dir="ltr">
      <div className="border-t border-slate-200 w-full" />
      <div className="space-y-1">
        <div className="text-xs font-light text-slate-400">
          مهمك
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-300">
          AL MARAGHI
        </div>
      </div>
    </div>
  )

  // --- STEP 1: LANGUAGE PICKER ---
  if (currentStep === "language") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-800 selection:bg-indigo-500 selection:text-white" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex-1 flex items-center justify-center w-full py-8">
          <Card className="max-w-lg w-full border border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-white p-6 md:p-8 text-center space-y-8 animate-scale-in">
            <div className="space-y-3">
              <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-sm">
                <Globe className="size-8 animate-pulse" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
                Al Maraghi / مهمك
              </h1>
              <p className="text-sm text-slate-500">
                Select your preferred language / اختر لغتك المفضلة
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <button
                onClick={() => handleSelectLanguage("en")}
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500 text-slate-800 font-bold text-base transition-all duration-200 shadow-sm flex items-center justify-between cursor-pointer"
              >
                <span>English</span>
                <span className="text-xs text-indigo-600 font-medium">Continue →</span>
              </button>

              <button
                onClick={() => handleSelectLanguage("ar")}
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500 text-slate-800 font-bold text-base transition-all duration-200 shadow-sm flex items-center justify-between cursor-pointer"
              >
                <span>العربية</span>
                <span className="text-xs text-indigo-600 font-medium">المتابعة ←</span>
              </button>
            </div>
          </Card>
        </div>
        {renderFooter()}
      </div>
    )
  }

  // --- STEP 2: DETAILS INPUT FORM ---
  if (currentStep === "details") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-800" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex-1 flex items-center justify-center w-full py-8">
          <Card className="max-w-lg w-full border border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-white p-6 md:p-8 space-y-6 animate-fade-in">
            {/* Header & Language Toggle */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {isArabic ? "مهمك - Al Maraghi" : "Al Maraghi Feedback"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isArabic ? "الرجاء إدخال تفاصيل المركبة" : "Please enter your vehicle details"}
                </p>
              </div>
              <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleToggleLanguage("en")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${locale === "en" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLanguage("ar")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${locale === "ar" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  عربي
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitDetails} className="space-y-5">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Plate Number (Required) */}
              <div className="space-y-2">
                <Label htmlFor="plateNumber" className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Car className="size-4 text-indigo-600" />
                    <span>
                      {isArabic ? "رقم لوحة المركبة" : "Vehicle Plate Number"}
                      <span className="text-rose-500 ml-1">*</span>
                    </span>
                  </span>
                </Label>

                <div className="flex gap-2 w-full items-stretch">
                  {/* Emirate Select */}
                  <div className="flex-[2]">
                    <Select value={selectedEmirate} onValueChange={handleEmirateChange}>
                      <SelectTrigger
                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl text-base focus:ring-indigo-500 font-semibold pr-3 pl-3"
                        style={{ height: '48px', minHeight: '48px' }}
                      >
                        <SelectValue placeholder={isArabic ? "الإمارة" : "Emirate"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-800 rounded-xl max-h-60 overflow-y-auto">
                        {uniqueEmirates.map((item) => (
                          <SelectItem key={item.emirate} value={item.emirate} className="hover:bg-slate-100 focus:bg-slate-100 cursor-pointer">
                            {isArabic ? item.emirate_ar : item.emirate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Select */}
                  <div className="flex-[1]">
                    <Select
                      value={selectedCategory}
                      onValueChange={(val) => setSelectedCategory(val || "")}
                      disabled={!selectedEmirate}
                    >
                      <SelectTrigger
                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl text-base focus:ring-indigo-500 font-semibold pr-3 pl-3 disabled:opacity-50"
                        style={{ height: '48px', minHeight: '48px' }}
                      >
                        <SelectValue placeholder={isArabic ? "الفئة" : "Category"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-800 rounded-xl max-h-60 overflow-y-auto">
                        {filteredCategories.map((item) => (
                          <SelectItem key={item.code} value={item.code} className="hover:bg-slate-100 focus:bg-slate-100 cursor-pointer">
                            {item.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Plate Digits Input */}
                  <div className="flex-[1]">
                    <Input
                      id="plateDigits"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={plateDigits}
                      onChange={(e) => handleDigitsChange(e.target.value)}
                      placeholder="12345"
                      className="bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 rounded-xl text-base focus-visible:ring-indigo-500 font-semibold uppercase tracking-wider"
                      style={{ height: '48px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Mobile Number (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="mobileNumber" className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-4 text-indigo-600" />
                    <span>{isArabic ? "رقم الهاتف المحمول" : "Mobile Number"}</span>
                  </span>
                  <span className="text-slate-400 text-xs font-normal">{isArabic ? "(اختياري)" : "(Optional)"}</span>
                </Label>
                <Input
                  id="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  placeholder={isArabic ? "مثال: 0501234567" : "e.g. 0501234567"}
                  className="bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 rounded-xl h-12 text-base focus-visible:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 leading-normal">
                  {isArabic
                    ? "رقم الهاتف المحمول اختياري."
                    : "Mobile number is optional."}
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !selectedEmirate || !selectedCategory || !plateDigits.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 rounded-xl text-base shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    <span>{isArabic ? "جاري البدء..." : "Starting Survey..."}</span>
                  </span>
                ) : (
                  <span>{form.is_visit_journey ? (isArabic ? "التالي" : "Next") : (isArabic ? "بدء الاستبيان" : "Start Feedback Survey")}</span>
                )}
              </Button>
            </form>
          </Card>
        </div>
        {renderFooter()}
      </div>
    )
  }

  // --- STEP 2.5: VISIT STAGE SELECTOR (Drop-off / Pick-up) ---
  if (currentStep === "stage") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-800" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex-1 flex items-center justify-center w-full py-8">
          <Card className="max-w-lg w-full border border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-white p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {isArabic ? "مرحلة الزيارة" : "Purpose of Visit"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isArabic ? "الرجاء تحديد نوع الخدمة للمركبة" : "Please select your visit stage"}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700">
                {plateNumber.trim().toUpperCase()}
              </span>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateSession("drop_off")}
                className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500 text-slate-800 transition-all duration-200 shadow-sm flex items-center gap-4 cursor-pointer text-start group disabled:opacity-50"
              >
                <div className="size-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <LogIn className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-slate-800 group-hover:text-indigo-600 transition">
                    {isArabic ? "تسليم المركبة (Drop-off)" : "Drop-off (Service Handover)"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isArabic ? "تسليم المركبة للصيانة والإصلاح" : "Dropping off your vehicle for service"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateSession("pick_up")}
                className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500 text-slate-800 transition-all duration-200 shadow-sm flex items-center gap-4 cursor-pointer text-start group disabled:opacity-50"
              >
                <div className="size-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <LogOut className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-slate-800 group-hover:text-emerald-600 transition">
                    {isArabic ? "استلام المركبة (Pick-up)" : "Pick-up (Vehicle Collection)"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isArabic ? "استلام المركبة بعد انتهاء الخدمة" : "Picking up your vehicle after service completion"}
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-start">
              <Button
                type="button"
                disabled={submitting}
                onClick={() => setCurrentStep("details")}
                variant="ghost"
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs flex items-center gap-1.5"
              >
                <span>{isArabic ? "← الرجوع لتعديل رقم اللوحة" : "← Back to edit plate"}</span>
              </Button>
            </div>
          </Card>
        </div>
        {renderFooter()}
      </div>
    )
  }

  // --- DUPLICATE BLOCKED VIEW ---
  if (currentStep === "duplicate") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-800" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex-1 flex items-center justify-center w-full py-8">
          <Card className="max-w-lg w-full border border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-white p-6 md:p-8 text-center space-y-6 animate-scale-in">
            <div className="size-16 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto">
              <ShieldAlert className="size-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-800">
                {isArabic ? "تم تقديم تقييم سابق" : "Feedback Already Submitted"}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isArabic
                  ? `تم تقديم استبيان لتقييم الخدمة للمركبة (${plateNumber.toUpperCase()}) خلال الـ 6 ساعات الماضية. شكراً لمشاركتك!`
                  : `A feedback survey was already submitted for plate (${plateNumber.toUpperCase()}) within the last 6 hours. Thank you!`}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              {disputeNotified ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="size-4" />
                  <span>{isArabic ? "تم إبلاغ موظف الاستقبال. شكراً لك!" : "Staff have been notified. Thank you!"}</span>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleNotifyStaffDispute}
                  disabled={notifyingDispute}
                  variant="outline"
                  className="w-full border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold h-11 rounded-xl text-xs"
                >
                  {notifyingDispute ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span>{isArabic ? "جاري الإبلاغ..." : "Notifying..."}</span>
                    </span>
                  ) : (
                    <span>{isArabic ? "هناك خطأ، إبلاغ الموظفين" : "This seems wrong, notify staff"}</span>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
        {renderFooter()}
      </div>
    )
  }

  // --- STEP 3: SURVEY EXPERIENCE ---
  if (currentStep === "survey" && session) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between">
        <div className="flex-1 flex flex-col">
          <SurveyClient
            session={session}
            form={form}
            facilitySettings={facilitySettings}
            isPublicMode={true}
          />
        </div>
        <div className="flex justify-center p-4 w-full">
          {renderFooter()}
        </div>
      </div>
    )
  }

  return null
}
