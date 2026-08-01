"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FormBuilder, BuilderField } from "@/components/forms/FormBuilder"
import { TypePicker, FormType } from "@/components/forms/TypePicker"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

export interface NewFormClientProps {
  userId: string
  types: FormType[]
}

export function NewFormClient({ userId, types }: NewFormClientProps) {
  const router = useRouter()
  const t = useTranslations("Forms")
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = async (
    name: string,
    description: string,
    fields: BuilderField[],
    nameAr: string,
    descriptionAr: string,
    isVisitJourney: boolean
  ) => {
    if (!selectedType) return
    setIsSaving(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("forms").insert({
        name,
        description,
        fields,
        name_ar: nameAr,
        description_ar: descriptionAr,
        is_visit_journey: isVisitJourney,
        status: "active", // Save as active by default so it's ready to use
        created_by: userId,
        parent_id: null, // Root version
        type: selectedType, // The selected form type
      })

      if (error) {
        throw error
      }

      toast.success(t("savedSuccess"))
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
    if (selectedType) {
      // Go back to type selection step
      setSelectedType(null)
    } else {
      // Go back to listing page
      router.push("/dashboard/forms")
    }
  }

  if (!selectedType) {
    return <TypePicker types={types} onSelect={setSelectedType} />
  }

  return (
    <FormBuilder
      formType={selectedType}
      isSaving={isSaving}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
}
