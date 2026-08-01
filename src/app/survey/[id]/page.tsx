import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { decryptPlate } from "@/lib/utils/plate-number"
import { SurveyClient } from "./SurveyClient"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SurveyKioskPage({ params }: PageProps) {
  const { id } = await params

  // 1. Fetch session server-side using admin client (Security Fix - no public select policy)
  const admin = createAdminClient()
  const { data: rawSession, error: sessionError } = await admin
    .from("sessions")
    .select("id, form_id, location_id, status, language, plate_number_encrypted, visit_stage")
    .eq("id", id)
    .single()

  if (sessionError || !rawSession) {
    notFound()
  }

  const plateNumber = decryptPlate(rawSession.plate_number_encrypted)
  const { plate_number_encrypted, ...sanitizedSession } = rawSession

  // 2. Fetch the corresponding form layout
  const { data: form, error: formError } = await admin
    .from("forms")
    .select("id, name, description, fields")
    .eq("id", sanitizedSession.form_id)
    .single()

  if (formError || !form) {
    notFound()
  }

  // 3. Fetch facility settings (singleton)
  const { data: facilitySettings } = await admin
    .from("facility_settings")
    .select("google_review_url, review_qr_threshold_percent")
    .eq("id", "00000000-0000-0000-0000-000000000000")
    .single()

  const settings = facilitySettings || {
    google_review_url: "https://search.google.com/local/writereview?placeid=ChIJplaceholder",
    review_qr_threshold_percent: 90
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      <SurveyClient
        session={sanitizedSession}
        plateNumber={plateNumber}
        form={form}
        facilitySettings={settings}
      />
    </div>
  )
}
