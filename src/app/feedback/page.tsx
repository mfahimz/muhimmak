import { cookies } from "next/headers"
import { Card } from "@/components/ui/card"
import { ClockAlert } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PublicFeedbackPage() {
  const cookieStore = await cookies()
  const initialLocale = (cookieStore.get("NEXT_LOCALE")?.value || "en") as "en" | "ar"
  const isArabic = initialLocale === "ar"

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
