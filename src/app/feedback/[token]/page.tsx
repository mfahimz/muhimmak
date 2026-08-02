import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateQrToken } from "@/server/services/qr-rotation.service"
import { PublicFeedbackClient } from "../PublicFeedbackClient"
import { Card } from "@/components/ui/card"
import { ClockAlert } from "lucide-react"

export const dynamic = "force-dynamic"

function ExpiredFeedbackLink({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100" dir={isArabic ? "rtl" : "ltr"}>
      <Card className="max-w-md w-full border border-slate-800 shadow-2xl rounded-3xl bg-slate-900 p-8 text-center space-y-6">
        <div className="size-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <ClockAlert className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">
            {isArabic ? "انتهت صلاحية رابط التقييم" : "Feedback Link Expired"}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isArabic
              ? "انتهت صلاحية هذا الرابط. يرجى طلب رابط التقييم الخاص باليوم من موظفي الاستقبال."
              : "This link has expired. Please ask reception staff for today's active feedback QR link."}
          </p>
        </div>
      </Card>
    </div>
  )
}

export default async function DynamicTokenFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const cookieStore = await cookies()
  const initialLocale = (cookieStore.get("NEXT_LOCALE")?.value || "en") as "en" | "ar"
  const isArabic = initialLocale === "ar"

  // 1. Validate Token
  const isValid = await validateQrToken(token)

  if (!isValid) {
    return <ExpiredFeedbackLink isArabic={isArabic} />
  }

  const admin = createAdminClient()

  // 2. Fetch Facility Settings
  const { data: settings } = await admin
    .from("facility_settings")
    .select("default_form_id, google_review_url, review_qr_threshold_percent")
    .eq("id", "00000000-0000-0000-0000-000000000000")
    .single()

  const defaultFormId = settings?.default_form_id
  const googleReviewUrl = settings?.google_review_url || ""
  const threshold = settings?.review_qr_threshold_percent ?? 90

  // 3. Fetch Form if default_form_id exists
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
            <ClockAlert className="size-8" />
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
