import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PublicFeedbackClient } from "./PublicFeedbackClient"
import { Card } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PublicFeedbackPage() {
  const cookieStore = await cookies()
  const initialLocale = (cookieStore.get("NEXT_LOCALE")?.value || "en") as "en" | "ar"
  const isArabic = initialLocale === "ar"

  const admin = createAdminClient()

  // 1. Fetch Facility Settings
  const { data: settings } = await admin
    .from("facility_settings")
    .select("default_form_id, google_review_url, review_qr_threshold_percent")
    .eq("id", "00000000-0000-0000-0000-000000000000")
    .single()

  const defaultFormId = settings?.default_form_id
  const googleReviewUrl = settings?.google_review_url || ""
  const threshold = settings?.review_qr_threshold_percent ?? 90

  // 2. Fetch Form if default_form_id exists
  let form: any = null
  if (defaultFormId) {
    const { data: formData } = await admin
      .from("forms")
      .select("id, name, description, fields, status, is_visit_journey")
      .eq("id", defaultFormId)
      .single()

    if (formData && formData.status === "active") {
      form = formData
    }
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border border-slate-800 shadow-2xl rounded-3xl bg-slate-900 p-8 text-center space-y-6">
          <div className="size-16 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              {isArabic ? "خدمة تقييم العملاء غير متوفرة حالياً" : "Feedback System Unavailable"}
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              {isArabic
                ? "لم يتم تحديد نموذج الآراء الافتراضي بعد. يرجى مراجعة موظفي الاستقبال لتسهيل تقييمك."
                : "Public feedback is currently not configured or disabled. Please speak to our reception staff."}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <PublicFeedbackClient
      form={form}
      facilitySettings={{
        google_review_url: googleReviewUrl,
        review_qr_threshold_percent: threshold,
      }}
      initialLocale={initialLocale}
    />
  )
}
