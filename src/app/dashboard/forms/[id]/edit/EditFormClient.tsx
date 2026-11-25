"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FormBuilder, BuilderField } from "@/components/forms/FormBuilder"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { AlertCircle } from "lucide-react"

export interface EditFormClientProps {
  userId: string
  form: {
    id: string
    name: string
    description: string
    name_ar: string | null
    description_ar: string | null
    fields: any
    status: string
    parent_id: string | null
    type?: string | null
    is_visit_journey?: boolean | null
  }
}

export function EditFormClient({ form }: EditFormClientProps) {
  const router = useRouter()
  const t = useTranslations("Forms")
  const [isSaving, setIsSaving] = React.useState(false)
  const [hasResponses, setHasResponses] = React.useState(false)
  const [checkingResponses, setCheckingResponses] = React.useState(true)

  // Parse fields
  const initialFields = React.useMemo(() => {
    if (Array.isArray(form.fields)) {
      return form.fields as BuilderField[]
    }
    return []
  }, [form.fields])

  // Check if responses exist for this form on mount
  React.useEffect(() => {
    const checkResponses = async () => {
      const supabase = createClient()
      try {
        const { count, error } = await supabase
          .from("responses")
          .select("id", { count: "exact", head: true })
          .eq("form_id", form.id)

        if (!error && count !== null) {
          setHasResponses(count > 0)
        }
      } catch (err) {
        console.error("Failed to check responses:", err)
      } finally {
        setCheckingResponses(false)
      }
    }

    checkResponses()
  }, [form.id])

  const handleSave = async (
    name: string,
    description: string,
    fields: BuilderField[],
    nameAr: string,
    descriptionAr: string,
    isVisitJourney: boolean
  ) => {
    setIsSaving(true)

    try {
      const response = await fetch("/api/v1/forms/version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: form.id,
          name,
          description,
          fields,
          nameAr,
          descriptionAr,
          isVisitJourney,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Could not save form version")
      }

      if (data.versionCreated) {
        toast.success(t("versionCreated"))
      } else {
        toast.success(t("savedSuccess"))
      }

      router.push("/dashboard/forms")
      router.refresh()
    } catch (err: any) {
      console.error("Error saving form:", err)
      toast.error(t("errorSave") + `: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/dashboard/forms")
  }

  return (
    <div className="space-y-4">
      {!checkingResponses && hasResponses && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-50/60 border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Versioning Notice:</span>
            <p className="opacity-90 leading-normal">
              This form already has customer responses. Saving your edits will automatically create a new version of this form, and close the old version. Existing response data will remain intact and linked to the old version.
            </p>
          </div>
        </div>
      )}

      <FormBuilder
        formType={form.type}
        initialName={form.name}
        initialDescription={form.description || ""}
        initialNameAr={form.name_ar || ""}
        initialDescriptionAr={form.description_ar || ""}
        initialFields={initialFields}
        initialIsVisitJourney={form.is_visit_journey ?? false}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
