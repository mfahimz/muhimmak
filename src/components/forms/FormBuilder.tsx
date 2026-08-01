"use client"

import * as React from "react"
import { ArrowUp, ArrowDown, Trash2, Plus, X, Star, FileText, List, Sparkles, GitBranch, ChevronDown, ChevronUp, LogIn, LogOut, AlertTriangle } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { toArabicNumerals } from "@/lib/utils/arabic-numerals"

export type FieldCondition = {
  fieldId: string
  operator: 'equals' | 'not_equals' | 'lte' | 'gte'
  value: string | number
}

export interface BuilderField {
  id: string
  order: number
  type: "star_rating" | "text" | "multiple_choice" | "numeric_scale"
  label: string
  required: boolean
  options: string[]
  dependsOn?: FieldCondition | null
  weight?: number
  optionScores?: number[]
  ar?: { label: string; options: string[] }
  visit_stage?: 'drop_off' | 'pick_up'
}

export interface FormBuilderProps {
  formType?: string | null
  initialName?: string
  initialDescription?: string
  initialNameAr?: string
  initialDescriptionAr?: string
  initialFields?: BuilderField[]
  initialIsVisitJourney?: boolean
  isSaving?: boolean
  onSave: (
    name: string,
    description: string,
    fields: BuilderField[],
    nameAr: string,
    descriptionAr: string,
    isVisitJourney: boolean
  ) => void
  onCancel: () => void
}

const generateUUID = () => {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }
  return "f-" + Math.random().toString(36).substring(2, 11) + "-" + Math.random().toString(36).substring(2, 7)
}

export function FormBuilder({
  formType = null,
  initialName = "",
  initialDescription = "",
  initialNameAr = "",
  initialDescriptionAr = "",
  initialFields = [],
  initialIsVisitJourney = false,
  isSaving = false,
  onSave,
  onCancel,
}: FormBuilderProps) {
  const t = useTranslations("Forms")
  const tAI = useTranslations("FormBuilder")
  const locale = useLocale()

  const isTypeB = formType === "smart" || formType === "type_b"
  const [isVisitJourney, setIsVisitJourney] = React.useState<boolean>(isTypeB ? initialIsVisitJourney : false)
  const [stageTab, setStageTab] = React.useState<'drop_off' | 'pick_up'>('drop_off')
  const [showConfirmTurnOffModal, setShowConfirmTurnOffModal] = React.useState<boolean>(false)
  
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState(initialDescription)
  const [fields, setFields] = React.useState<BuilderField[]>(initialFields)
  const [suggesting, setSuggesting] = React.useState(false)

  // AI Assistant States
  const [aiGoal, setAiGoal] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [aiGoalError, setAiGoalError] = React.useState<string | null>(null)
  
  const [isSuggestingNext, setIsSuggestingNext] = React.useState(false)
  const [aiSuggestNextError, setAiSuggestNextError] = React.useState<string | null>(null)
  const [isSuggestingBranching, setIsSuggestingBranching] = React.useState(false)

  // AI Form Generator (Type C) States
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false)
  const [aiModalDescription, setAiModalDescription] = React.useState("")
  const [aiModalCountMode, setAiModalCountMode] = React.useState<'number' | 'ai'>('number')
  const [aiModalQuestionCount, setAiModalQuestionCount] = React.useState<number>(5)
  const [isAiModalGenerating, setIsAiModalGenerating] = React.useState(false)
  const [showAiConfirmReplace, setShowAiConfirmReplace] = React.useState(false)

  const executeAiGeneration = async () => {
    if (!aiModalDescription.trim()) return
    setIsAiModalGenerating(true)
    try {
      const payload = {
        description: aiModalDescription.trim(),
        questionCount: aiModalCountMode === 'ai' ? 'ai' : aiModalQuestionCount,
      }
      const response = await fetch("/api/v1/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || tAI("aiModal.errorToast"))
      }

      const data = await response.json()
      if (!data.fields || !Array.isArray(data.fields)) {
        throw new Error(tAI("aiModal.errorToast"))
      }

      const mappedFields: BuilderField[] = data.fields.map((f: any, idx: number) => {
        const isMultipleChoice = f.type === "multiple_choice"
        const opts = Array.isArray(f.options) ? f.options : []
        return {
          id: crypto.randomUUID(),
          order: idx + 1,
          type: f.type,
          label: f.label || "",
          required: true,
          options: opts,
          dependsOn: null,
          weight: f.weight ?? 0,
          optionScores: isMultipleChoice ? new Array(opts.length).fill(0) : undefined,
        }
      })

      setFields(mappedFields)
      setIsAiModalOpen(false)
      setShowAiConfirmReplace(false)
      setActiveTab('en')
      toast.success(tAI("aiModal.successToast"))
    } catch (err: any) {
      console.error("Generate with AI error:", err)
      toast.error(err.message || tAI("aiModal.errorToast"))
    } finally {
      setIsAiModalGenerating(false)
    }
  }

  const handleAiModalSubmitClick = (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiModalDescription.trim()) return
    if (fields.length > 0 && !showAiConfirmReplace) {
      setShowAiConfirmReplace(true)
      return
    }
    executeAiGeneration()
  }

  // Bilingual (Arabic) states
  const [activeTab, setActiveTab] = React.useState<'en' | 'ar'>('en')
  const [nameAr, setNameAr] = React.useState<string>(initialNameAr ?? '')
  const [descriptionAr, setDescriptionAr] = React.useState<string>(initialDescriptionAr ?? '')
  const [isTranslating, setIsTranslating] = React.useState<boolean>(false)
  const [translatingFieldId, setTranslatingFieldId] = React.useState<string | null>(null)
  const [staleFieldIds, setStaleFieldIds] = React.useState<Set<string>>(new Set())
  const [reorderedFieldIds, setReorderedFieldIds] = React.useState<Set<string>>(new Set())
  const [expandedConditions, setExpandedConditions] = React.useState<Set<string>>(new Set())
  const [aiDraftAr, setAiDraftAr] = React.useState<{
    name_ar: string;
    description_ar: string;
    fields: { id: string; ar: { label: string; options: string[] } }[]
  } | null>(null)

  // Stage field categorizations
  const dropOffFields = React.useMemo(() => {
    return fields.filter(f => !f.visit_stage || f.visit_stage === 'drop_off')
  }, [fields])

  const pickUpFields = React.useMemo(() => {
    return fields.filter(f => f.visit_stage === 'pick_up')
  }, [fields])

  const currentStageFields = React.useMemo(() => {
    if (!isVisitJourney) return fields
    return stageTab === 'drop_off' ? dropOffFields : pickUpFields
  }, [isVisitJourney, stageTab, fields, dropOffFields, pickUpFields])

  // Compute weights total
  const scoreableFields = React.useMemo(() => {
    return fields.filter(f => f.type === "star_rating" || f.type === "multiple_choice" || f.type === "text" || f.type === "numeric_scale")
  }, [fields])

  const totalWeight = React.useMemo(() => {
    return scoreableFields.reduce((sum, f) => sum + (f.weight || 0), 0)
  }, [scoreableFields])

  const dropOffScoreable = React.useMemo(() => {
    return dropOffFields.filter(f => f.type === "star_rating" || f.type === "multiple_choice" || f.type === "text" || f.type === "numeric_scale")
  }, [dropOffFields])

  const dropOffTotalWeight = React.useMemo(() => {
    return dropOffScoreable.reduce((sum, f) => sum + (f.weight || 0), 0)
  }, [dropOffScoreable])

  const pickUpScoreable = React.useMemo(() => {
    return pickUpFields.filter(f => f.type === "star_rating" || f.type === "multiple_choice" || f.type === "text" || f.type === "numeric_scale")
  }, [pickUpFields])

  const pickUpTotalWeight = React.useMemo(() => {
    return pickUpScoreable.reduce((sum, f) => sum + (f.weight || 0), 0)
  }, [pickUpFields])

  const activeScoreableFields = React.useMemo(() => {
    if (!isVisitJourney) return scoreableFields
    return stageTab === 'drop_off' ? dropOffScoreable : pickUpScoreable
  }, [isVisitJourney, stageTab, scoreableFields, dropOffScoreable, pickUpScoreable])

  const activeTotalWeight = React.useMemo(() => {
    if (!isVisitJourney) return totalWeight
    return stageTab === 'drop_off' ? dropOffTotalWeight : pickUpTotalWeight
  }, [isVisitJourney, stageTab, totalWeight, dropOffTotalWeight, pickUpTotalWeight])

  const isSuggestReady = React.useMemo(() => {
    const allLabelsFilled = activeScoreableFields.every(f => f.label.trim() !== "")
    const allOptionsFilled = activeScoreableFields.every(f => {
      if (f.type !== "multiple_choice") return true
      return f.options.length >= 2 && f.options.every(opt => opt.trim() !== "")
    })
    return allLabelsFilled && allOptionsFilled
  }, [activeScoreableFields])

  const missingAr = React.useMemo(() => {
    return fields.some(f => !f.ar?.label?.trim())
  }, [fields])

  const handleToggleVisitJourney = (checked: boolean) => {
    if (!checked) {
      const hasPickUpFields = fields.some(f => f.visit_stage === 'pick_up')
      if (hasPickUpFields) {
        setShowConfirmTurnOffModal(true)
        return
      }
    }
    setIsVisitJourney(checked)
  }

  const handleConfirmTurnOffVisitJourney = () => {
    setIsVisitJourney(false)
    setShowConfirmTurnOffModal(false)
  }

  // Add a new question field
  const handleAddQuestion = () => {
    const newField: BuilderField = {
      id: generateUUID(),
      order: fields.length + 1,
      type: "text",
      label: "",
      required: true,
      options: [],
      dependsOn: null,
      weight: 0,
      visit_stage: isVisitJourney ? stageTab : undefined,
    }
    setFields([...fields, newField])
  }

  // Delete a question field
  const handleDeleteQuestion = (id: string) => {
    const updated = fields.filter((f) => f.id !== id)
    const reindexed = updated.map((f, index) => ({
      ...f,
      order: index + 1,
    }))
    setFields(reindexed)
  }

  // Update a question field property
  const handleUpdateField = (id: string, updates: Partial<BuilderField>) => {
    if ('label' in updates) {
      setStaleFieldIds(prev => new Set(prev).add(id))
    }
    setFields(
      fields.map((f) => {
        if (f.id === id) {
          const next = { ...f, ...updates }
          if (updates.type) {
            if (updates.type === "text") {
              next.weight = f.weight ?? 0
              delete next.optionScores
              next.options = []
            } else if (updates.type === "star_rating") {
              next.weight = f.weight ?? 0
              delete next.optionScores
              next.options = []
            } else if (updates.type === "numeric_scale") {
              next.weight = f.weight ?? 0
              delete next.optionScores
              next.options = []
            } else if (updates.type === "multiple_choice") {
              next.weight = f.weight ?? 0
              if (f.type !== "multiple_choice") {
                next.options = [`${tAI("optionDefault")} 1`]
                next.optionScores = [0]
              }
            }
          }
          return next
        }
        return f
      })
    )
  }

  // Move a question field up or down within current list
  const handleMoveField = (index: number, direction: "up" | "down") => {
    const list = isVisitJourney ? currentStageFields : fields
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === list.length - 1) return

    const targetIndex = direction === "up" ? index - 1 : index + 1
    const currentItem = list[index]
    const targetItem = list[targetIndex]

    setFields(prev => {
      return prev.map(f => {
        if (f.id === currentItem.id) return { ...f, order: targetItem.order }
        if (f.id === targetItem.id) return { ...f, order: currentItem.order }
        return f
      })
    })
  }

  // Add option to a multiple choice field
  const handleAddOption = (fieldId: string) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          const scores = f.optionScores ? [...f.optionScores] : []
          return {
            ...f,
            options: [...f.options, `${tAI("optionDefault")} ${f.options.length + 1}`],
            optionScores: [...scores, 0]
          }
        }
        return f
      })
    )
  }

  // Remove option from a multiple choice field
  const handleRemoveOption = (fieldId: string, optionIndex: number) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          const updatedOptions = f.options.filter((_, idx) => idx !== optionIndex)
          const updatedScores = f.optionScores ? f.optionScores.filter((_, idx) => idx !== optionIndex) : []
          return {
            ...f,
            options: updatedOptions,
            optionScores: updatedScores
          }
        }
        return f
      })
    )
  }

  function handleReorderOption(fieldId: string, fromIndex: number, direction: 'up' | 'down') {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
      if (toIndex < 0 || toIndex >= f.options.length) return f

      const newOptions = [...f.options]
      const newScores = f.optionScores ? [...f.optionScores] : []
      const newArOptions = f.ar?.options ? [...f.ar.options] : []

      ;[newOptions[fromIndex], newOptions[toIndex]] = [newOptions[toIndex], newOptions[fromIndex]]

      if (newScores.length > 0) {
        ;[newScores[fromIndex], newScores[toIndex]] = [newScores[toIndex], newScores[fromIndex]]
      }

      if (newArOptions.length > Math.max(fromIndex, toIndex)) {
        ;[newArOptions[fromIndex], newArOptions[toIndex]] = [newArOptions[toIndex], newArOptions[fromIndex]]
      }

      return {
        ...f,
        options: newOptions,
        optionScores: newScores.length > 0 ? newScores : f.optionScores,
        ar: f.ar ? { ...f.ar, options: newArOptions } : f.ar,
      }
    }))

    setStaleFieldIds(prev => new Set(prev).add(fieldId))
    setReorderedFieldIds(prev => new Set(prev).add(fieldId))
  }

  function getConditionSources(currentFieldIndex: number): BuilderField[] {
    const list = isVisitJourney ? currentStageFields : fields
    return list
      .slice(0, currentFieldIndex)
      .filter(f => f.type === 'multiple_choice' || f.type === 'star_rating' || f.type === 'numeric_scale')
  }

  function handleUpdateCondition(
    fieldId: string,
    condition: FieldCondition | null
  ) {
    setFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, dependsOn: condition } : f
    ))
  }

  // Update option value
  const handleUpdateOption = (fieldId: string, optionIndex: number, val: string) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          const updatedOptions = [...f.options]
          updatedOptions[optionIndex] = val
          return {
            ...f,
            options: updatedOptions,
          }
        }
        return f
      })
    )
    setStaleFieldIds(prev => new Set(prev).add(fieldId))
  }

  // Update option score value
  const handleUpdateOptionScore = (fieldId: string, optionIndex: number, val: number) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          const updatedScores = f.optionScores ? [...f.optionScores] : []
          while (updatedScores.length < f.options.length) {
            updatedScores.push(0)
          }
          updatedScores[optionIndex] = Math.min(100, Math.max(0, val))
          return {
            ...f,
            optionScores: updatedScores
          }
        }
        return f
      })
    )
  }

  const handleUpdateArabicLabel = (fieldId: string, val: string) => {
    setFields(prev => prev.map(f =>
      f.id === fieldId
        ? { ...f, ar: { label: val, options: f.ar?.options ?? [] } }
        : f
    ))
    setStaleFieldIds(prev => {
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  const handleUpdateArabicOption = (fieldId: string, optIdx: number, val: string) => {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      const updatedOptions = [...(f.ar?.options ?? [])]
      while (updatedOptions.length <= optIdx) updatedOptions.push('')
      updatedOptions[optIdx] = val
      return { ...f, ar: { label: f.ar?.label ?? '', options: updatedOptions } }
    }))
  }

  // Suggest weights from DeepSeek API
  const handleSuggestWeights = async () => {
    const targetFields = isVisitJourney ? activeScoreableFields : scoreableFields
    if (targetFields.length < 2) return
    setSuggesting(true)
    try {
      const response = await fetch("/api/v1/forms/suggest-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: targetFields.map((f) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            options: f.options,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(tAI("weightSuggestError"))
      }

      const data = await response.json()

      setFields((prev) =>
        prev.map((f) => {
          if (targetFields.some(tf => tf.id === f.id)) {
            const suggestedWeight = data.weights?.[f.id] ?? 0
            const suggestedScores = data.optionScores?.[f.id] ?? []
            return {
              ...f,
              weight: suggestedWeight,
              optionScores: f.type === "multiple_choice" ? suggestedScores : undefined,
            }
          }
          return f
        })
      )

      toast.success(tAI("weightSuggestSuccess"))
    } catch (err: any) {
      console.error(err)
      toast.error(tAI("weightSuggestFailed") + ": " + (err.message || err))
    } finally {
      setSuggesting(false)
    }
  }

  // AI Assistant - Generate Questions from Goal
  const handleGenerateQuestions = async () => {
    if (!aiGoal.trim()) return
    setIsGenerating(true)
    setAiGoalError(null)

    try {
      const response = await fetch("/api/v1/forms/suggest-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: aiGoal.trim() }),
      })

      if (!response.ok) {
        throw new Error(tAI("generateError"))
      }

      const data = await response.json()
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error(tAI("generateInvalidFormat"))
      }

      const mappedFields: BuilderField[] = data.questions.map((q: any, idx: number) => {
        const isMultipleChoice = q.type === "multiple_choice"
        return {
          id: crypto.randomUUID(),
          order: idx + 1,
          type: q.type,
          label: q.label || "",
          required: true,
          options: q.options || [],
          dependsOn: null,
          weight: 0,
          optionScores: isMultipleChoice ? new Array((q.options || []).length).fill(0) : undefined,
          visit_stage: isVisitJourney ? stageTab : undefined,
        }
      })

      setFields(mappedFields)
    } catch (err: any) {
      console.error("Generate questions error:", err)
      setAiGoalError(tAI("aiError"))
    } finally {
      setIsGenerating(false)
    }
  }

  // AI Assistant - Suggest Next Question
  const handleSuggestNextQuestion = async () => {
    const list = isVisitJourney ? currentStageFields : fields
    if (list.length === 0) return
    setIsSuggestingNext(true)
    setAiSuggestNextError(null)

    try {
      const existingQuestions = list.map(f => ({
        type: f.type,
        label: f.label,
        options: f.options
      }))

      const response = await fetch("/api/v1/forms/suggest-next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingQuestions }),
      })

      if (!response.ok) {
        throw new Error(tAI("suggestNextError"))
      }

      const data = await response.json()
      if (!data.question || typeof data.question !== "object") {
        throw new Error(tAI("suggestNextInvalidFormat"))
      }

      const q = data.question
      const isMultipleChoice = q.type === "multiple_choice"
      const newField: BuilderField = {
        id: crypto.randomUUID(),
        order: fields.length + 1,
        type: q.type,
        label: q.label || "",
        required: true,
        options: q.options || [],
        dependsOn: null,
        weight: 0,
        optionScores: isMultipleChoice ? new Array((q.options || []).length).fill(0) : undefined,
        visit_stage: isVisitJourney ? stageTab : undefined,
      }

      setFields([...fields, newField])
    } catch (err: any) {
      console.error("Suggest next question error:", err)
      setAiSuggestNextError(tAI("aiError"))
    } finally {
      setIsSuggestingNext(false)
    }
  }

  // AI Assistant — Suggest Branching Logic
  const handleSuggestBranching = async () => {
    const list = isVisitJourney ? currentStageFields : fields
    if (list.length <= 1) return
    setIsSuggestingBranching(true)
    try {
      const response = await fetch("/api/v1/forms/suggest-branching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: list.map(f => ({
            id: f.id,
            order: f.order,
            type: f.type,
            label: f.label,
            options: f.options,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error("Suggest branching failed")
      }

      const data = await response.json()
      if (Array.isArray(data.suggestions)) {
        setFields(prev => {
          const next = [...prev]
          data.suggestions.forEach((sug: any) => {
            if (!sug.fieldId || !sug.condition) return
            const idx = next.findIndex(f => f.id === sug.fieldId)
            if (idx !== -1 && !next[idx].dependsOn) {
              next[idx] = { ...next[idx], dependsOn: sug.condition }
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error("handleSuggestBranching error:", err)
    } finally {
      setIsSuggestingBranching(false)
    }
  }

  // Translation handlers
  const handleTranslateAll = async () => {
    if (fields.length === 0) return
    setIsTranslating(true)
    try {
      const response = await fetch("/api/v1/forms/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          fields: fields.map(f => ({ id: f.id, label: f.label, options: f.options })),
        }),
      })
      if (!response.ok) throw new Error(tAI("arabicPanel.translateAll") + " failed")
      const data = await response.json()
      setNameAr(data.name_ar || "")
      setDescriptionAr(data.description_ar || "")
      setFields(prev =>
        prev.map(f => {
          const translated = data.fields?.find((tf: any) => tf.id === f.id)
          if (translated) {
            return { ...f, ar: translated.ar }
          }
          return f
        })
      )
      setAiDraftAr(data)
      setStaleFieldIds(new Set())
    } catch (err) {
      console.error("handleTranslateAll error:", err)
    } finally {
      setIsTranslating(false)
    }
  }

  const handleTranslateField = async (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return
    setTranslatingFieldId(fieldId)
    try {
      const response = await fetch("/api/v1/forms/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: field.id,
          label: field.label,
          options: field.options,
        }),
      })
      if (!response.ok) throw new Error(tAI("arabicPanel.translateAll") + " failed")
      const data = await response.json()
      setFields(prev =>
        prev.map(f => f.id === fieldId ? { ...f, ar: data.ar } : f)
      )
      if (aiDraftAr) {
        setAiDraftAr(prev => {
          if (!prev) return prev
          const existingIdx = prev.fields.findIndex(f => f.id === fieldId)
          const updatedFields = [...prev.fields]
          if (existingIdx >= 0) {
            updatedFields[existingIdx] = { id: fieldId, ar: data.ar }
          } else {
            updatedFields.push({ id: fieldId, ar: data.ar })
          }
          return { ...prev, fields: updatedFields }
        })
      }
      setStaleFieldIds(prev => {
        const next = new Set(prev)
        next.delete(fieldId)
        return next
      })
    } catch (err) {
      console.error("handleTranslateField error:", err)
    } finally {
      setTranslatingFieldId(null)
    }
  }

  const handleRevertField = (fieldId: string) => {
    if (!aiDraftAr) return
    const draft = aiDraftAr.fields.find(f => f.id === fieldId)
    if (!draft) return
    setFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, ar: draft.ar } : f)
    )
    setStaleFieldIds(prev => {
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  // Handle save with validation guards
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (isVisitJourney) {
      // 1. Guard: must have at least 1 scoreable question in EACH tab
      if (dropOffScoreable.length === 0 || pickUpScoreable.length === 0) {
        toast.error(tAI("validationBothStagesRequired"))
        return
      }

      // 2. Guard: stage weights must sum to 100% independently
      if (dropOffScoreable.length > 0 && dropOffTotalWeight !== 100) {
        toast.error(tAI("validationStageWeightSumError", { stage: tAI("tabDropOff"), total: dropOffTotalWeight }))
        return
      }

      if (pickUpScoreable.length > 0 && pickUpTotalWeight !== 100) {
        toast.error(tAI("validationStageWeightSumError", { stage: tAI("tabPickUp"), total: pickUpTotalWeight }))
        return
      }
    } else {
      // Non-journey weight sum guard
      if (scoreableFields.length > 0 && totalWeight !== 100) {
        toast.error(tAI("weightSumError", { total: totalWeight }))
        return
      }
    }

    onSave(name.trim(), description.trim(), fields, nameAr, descriptionAr, isVisitJourney)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Language Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('en')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'en'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tAI("tabs.english")}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('ar')
            setReorderedFieldIds(new Set())
          }}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'ar'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tAI("tabs.arabic")}
          {staleFieldIds.size > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full ml-2">
              {staleFieldIds.size} {tAI("arabicPanel.outdatedBadge")}
            </span>
          )}
        </button>
      </div>

      {/* Arabic translation helper header */}
      {activeTab === 'ar' && (
        <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 p-4 rounded-2xl shadow-xs mb-4">
          <h2 className="text-slate-700 dark:text-slate-300 font-medium text-sm">{tAI("arabicPanel.title")}</h2>
          <div className="flex items-center gap-3">
            {fields.length === 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {tAI("arabicPanel.noQuestionsToTranslate")}
              </span>
            )}
            <button
              type="button"
              onClick={handleTranslateAll}
              disabled={isTranslating || fields.length === 0}
              className="border border-indigo-500 text-indigo-600 text-sm px-3 py-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/20 disabled:opacity-50 transition-colors"
            >
              {isTranslating ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin size-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {tAI("arabicPanel.translating")}
                </span>
              ) : <>{tAI("arabicPanel.translateAll")} ✦</>}
            </button>
          </div>
        </div>
      )}

      {/* Visit Journey Toggle (Type B only) */}
      {isTypeB && (
        <Card className="border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl shadow-xs mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <GitBranch className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {tAI("visitJourneyToggle")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {tAI("visitJourneyDesc")}
                </p>
              </div>
            </div>
            <Switch
              checked={isVisitJourney}
              onCheckedChange={handleToggleVisitJourney}
            />
          </div>
        </Card>
      )}

      {/* Name and Description Panel */}
      <Card className="border border-slate-200 shadow-xs dark:border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {activeTab === 'en' ? `${t("name")} *` : `${tAI("arabicPanel.namePlaceholder")} *`}
            </Label>
            <Input
              id="form-name"
              value={activeTab === 'en' ? name : nameAr}
              onChange={(e) => activeTab === 'en' ? setName(e.target.value) : setNameAr(e.target.value)}
              placeholder={activeTab === 'en' ? t("placeholderName") : "اسم النموذج"}
              required
              dir={activeTab === 'ar' ? "rtl" : "ltr"}
              className={`h-10 border-slate-200 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 ${
                activeTab === 'ar' ? "text-right" : ""
              }`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-desc" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {activeTab === 'en' ? t("placeholderDescription") : tAI("arabicPanel.descriptionPlaceholder")}
            </Label>
            <textarea
              id="form-desc"
              value={activeTab === 'en' ? description : descriptionAr}
              onChange={(e) => activeTab === 'en' ? setDescription(e.target.value) : setDescriptionAr(e.target.value)}
              placeholder={activeTab === 'en' ? t("placeholderDescription") : "وصف النموذج"}
              rows={3}
              dir={activeTab === 'ar' ? "rtl" : "ltr"}
              className={`flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 ${
                activeTab === 'ar' ? "text-right" : ""
              }`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stage Tab Bar (when Visit Journey is enabled) */}
      {isVisitJourney && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 my-4 font-semibold text-xs">
          <button
            type="button"
            onClick={() => setStageTab('drop_off')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition ${
              stageTab === 'drop_off'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogIn className="size-4" />
            <span>{tAI("tabDropOff")} ({dropOffFields.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStageTab('pick_up')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition ${
              stageTab === 'pick_up'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogOut className="size-4" />
            <span>{tAI("tabPickUp")} ({pickUpFields.length})</span>
          </button>
        </div>
      )}

      {/* Questions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span>{t("questions")}</span>
            <span className="inline-flex items-center justify-center size-6 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-full dark:bg-indigo-950/50 dark:text-indigo-400">
              {currentStageFields.length}
            </span>
          </h3>

          {activeScoreableFields.length > 0 && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              activeTotalWeight === 100
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            }`}>
              {tAI("weightSumLabel")} {toArabicNumerals(activeTotalWeight, locale)}% / {toArabicNumerals(100, locale)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {formType === 'ai' && (
            <Button
              type="button"
              onClick={() => {
                setShowAiConfirmReplace(false)
                setIsAiModalOpen(true)
              }}
              variant="outline"
              className="flex items-center gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50/50 hover:text-purple-700 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-950/20"
            >
              <Sparkles className="size-4 text-purple-500" />
              <span>{tAI("aiModal.generateWithAi")}</span>
            </Button>
          )}

          {activeScoreableFields.length >= 2 && (
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                onClick={handleSuggestWeights}
                disabled={suggesting || !isSuggestReady}
                variant="outline"
                className="flex items-center gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50/50 hover:text-amber-700 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/20 disabled:opacity-50"
              >
                <Sparkles className="size-4 animate-pulse" />
                <span>{suggesting ? tAI("suggestingLabel") : t("suggestWeights")}</span>
              </Button>
              {!isSuggestReady && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[220px] text-right leading-tight font-medium">
                  {t("suggestWeightsHelper")}
                </span>
              )}
            </div>
          )}

          {currentStageFields.length > 1 && (
            <Button
              type="button"
              onClick={handleSuggestBranching}
              disabled={isSuggestingBranching}
              variant="outline"
              className="flex items-center gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-950/20 disabled:opacity-50"
            >
              <GitBranch className={`size-4 ${isSuggestingBranching ? "animate-spin" : ""}`} />
              <span>
                {isSuggestingBranching
                  ? tAI("conditionEditor.suggestingBranching")
                  : tAI("conditionEditor.suggestBranching")}
              </span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handleAddQuestion}
            variant="outline"
            className="flex items-center gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
          >
            <Plus className="size-4" />
            <span>{t("addQuestion")}</span>
          </Button>
        </div>
      </div>

      {/* Questions List */}
      {currentStageFields.length === 0 ? (
        <div className="space-y-6">
          {/* Touchpoint 1: AI Goal Generator Panel */}
          {formType !== 'ai' && (
            <Card className="border border-indigo-100 bg-indigo-50/20 dark:border-indigo-900/40 dark:bg-indigo-950/5 rounded-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                  <Sparkles className="size-4" />
                  <span>{tAI("aiPanelTitle")}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  {tAI("aiPanelSubtitle")}
                </p>
                <textarea
                  value={aiGoal}
                  onChange={(e) => setAiGoal(e.target.value)}
                  placeholder={tAI("aiGoalPlaceholder")}
                  rows={3}
                  className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
                {aiGoalError && (
                  <p className="text-xs text-rose-500 font-medium">{aiGoalError}</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating || !aiGoal.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                  >
                    {isGenerating ? tAI("aiGenerating") : tAI("aiGenerateButton")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 py-12 text-center rounded-xl">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                <FileText className="size-6" />
              </div>
              <p className="text-sm font-medium text-slate-500">{t("noForms")}</p>
              <Button
                type="button"
                onClick={handleAddQuestion}
                className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4"
              >
                <Plus className="size-4 mr-1.5" />
                {t("addQuestion")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {currentStageFields.map((field, index) => {
            const isFirst = index === 0
            const isLast = index === currentStageFields.length - 1

            return (
              <Card
                key={field.id}
                className="border border-slate-200 dark:border-slate-800 shadow-xs relative transition-all hover:border-slate-300 dark:hover:border-slate-700 group"
              >
                <CardContent className="p-5 flex gap-4">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 dark:bg-slate-900/20 px-2 rounded-lg py-3">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveField(index, "up")}
                      className={`p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                        isFirst ? "text-slate-300 dark:text-slate-800 cursor-not-allowed" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-400 select-none">
                      {field.order}
                    </span>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveField(index, "down")}
                      className={`p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                        isLast ? "text-slate-300 dark:text-slate-800 cursor-not-allowed" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>

                  {/* Question Config */}
                  <div className="flex-1 space-y-4">
                    {/* Staleness warning */}
                    {activeTab === 'ar' && staleFieldIds.has(field.id) && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-400 text-amber-700 dark:text-amber-400 text-[11px] p-2 rounded-lg">
                        {tAI("arabicPanel.staleWarning")}
                      </div>
                    )}

                    {/* Question Label, Type row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      <div className="md:col-span-8 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {activeTab === 'en' ? t("questionLabel") : `${t("questionLabel")} (Arabic)`}
                        </Label>
                        {activeTab === 'ar' && (
                          <p className="text-xs text-slate-400 mb-1">{field.label || "(Empty English Label)"}</p>
                        )}
                        <Input
                          value={activeTab === 'en' ? field.label : (field.ar?.label ?? "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (activeTab === 'en') {
                              handleUpdateField(field.id, { label: val });
                            } else {
                              handleUpdateArabicLabel(field.id, val);
                            }
                          }}
                          placeholder={activeTab === 'en' ? t("questionLabel") : "نص السؤال باللغة العربية"}
                          required
                          dir={activeTab === 'ar' ? "rtl" : "ltr"}
                          className={`h-9 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 text-sm ${
                            activeTab === 'ar' ? "text-right" : ""
                          }`}
                        />
                      </div>

                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {t("questionType")}
                        </Label>
                        <Select
                          value={field.type}
                          onValueChange={(val: any) => handleUpdateField(field.id, { type: val })}
                        >
                          <SelectTrigger className="h-9 border-slate-200 dark:border-slate-800 text-sm focus-visible:ring-indigo-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">
                              <span className="flex items-center gap-1.5">
                                <FileText className="size-3.5 text-slate-400" />
                                {t("textAnswer")}
                              </span>
                            </SelectItem>
                            <SelectItem value="star_rating">
                              <span className="flex items-center gap-1.5">
                                <Star className="size-3.5 text-slate-400" />
                                {t("starRating")}
                              </span>
                            </SelectItem>
                            <SelectItem value="numeric_scale">
                              <span className="flex items-center gap-1.5">
                                <List className="size-3.5 text-slate-400" />
                                {t("numericScale")}
                              </span>
                            </SelectItem>
                            <SelectItem value="multiple_choice">
                              <span className="flex items-center gap-1.5">
                                <List className="size-3.5 text-slate-400" />
                                {t("multipleChoice")}
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Weight scoring field for scoreable questions */}
                    {(field.type === "star_rating" || field.type === "multiple_choice" || field.type === "text" || field.type === "numeric_scale") && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 max-w-[200px] bg-slate-50/50 dark:bg-slate-900/20 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                          <Label htmlFor={`weight-${field.id}`} className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {tAI("weightLabel")}
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              id={`weight-${field.id}`}
                              type="number"
                              min={0}
                              max={100}
                              value={field.weight ?? 0}
                              onChange={(e) => handleUpdateField(field.id, { weight: parseInt(e.target.value) || 0 })}
                              className="w-16 h-7 text-xs text-center border-slate-200 focus-visible:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </div>
                        </div>
                        {field.type === "text" && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-1 leading-normal">
                            {tAI("textWeightNote")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Options list for Multiple Choice */}
                    {field.type === "multiple_choice" && (
                      <div className="bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-2.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                          {t("options")}
                        </Label>
                        
                        <div className="space-y-2">
                          {field.options.map((option, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={optIdx === 0}
                                  onClick={() => handleReorderOption(field.id, optIdx, 'up')}
                                  className={`p-0.5 rounded transition-colors ${
                                    optIdx === 0
                                      ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed'
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  <ChevronUp className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={optIdx === field.options.length - 1}
                                  onClick={() => handleReorderOption(field.id, optIdx, 'down')}
                                  className={`p-0.5 rounded transition-colors ${
                                    optIdx === field.options.length - 1
                                      ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed'
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  <ChevronDown className="size-3" />
                                </button>
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                {activeTab === 'ar' && (
                                  <span className="text-[10px] text-slate-400 ml-1">{option || "(Empty Option)"}</span>
                                )}
                                <Input
                                  value={activeTab === 'en' ? option : (field.ar?.options?.[optIdx] ?? "")}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (activeTab === 'en') {
                                      handleUpdateOption(field.id, optIdx, val);
                                    } else {
                                      handleUpdateArabicOption(field.id, optIdx, val);
                                    }
                                  }}
                                  className={`h-8 border-slate-200 dark:border-slate-800 text-xs py-1 w-full ${
                                    activeTab === 'ar' ? "text-right" : ""
                                  }`}
                                  placeholder={activeTab === 'en' ? t("optionPlaceholder") : "الخيار بالعربية"}
                                  required
                                  dir={activeTab === 'ar' ? "rtl" : "ltr"}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{tAI("scoreLabel")}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={field.optionScores?.[optIdx] ?? 0}
                                  onChange={(e) => handleUpdateOptionScore(field.id, optIdx, parseInt(e.target.value) || 0)}
                                  className="w-14 h-8 border-slate-200 dark:border-slate-800 text-xs text-center p-1"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveOption(field.id, optIdx)}
                                disabled={field.options.length <= 1}
                                className="size-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50/30"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddOption(field.id)}
                          className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 px-2 mt-1"
                        >
                          <Plus className="size-3 mr-1" />
                          {t("addOption")}
                        </Button>
                      </div>
                    )}

                    {/* Option reorder warning */}
                    {reorderedFieldIds.has(field.id) && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-400 text-amber-700 dark:text-amber-400 text-xs p-2 rounded-sm">
                        {tAI("conditionEditor.reorderWarning")}
                      </div>
                    )}

                    {/* Condition editor — only show if this is not the first question */}
                    {index > 0 && (() => {
                      const sources = getConditionSources(index)
                      if (sources.length === 0) return null

                      const isOpen = expandedConditions.has(field.id)
                      const condition = field.dependsOn

                      return (
                        <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                          {/* Condition toggle header */}
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedConditions(prev => {
                                const next = new Set(prev)
                                if (next.has(field.id)) {
                                  next.delete(field.id)
                                } else {
                                  next.add(field.id)
                                }
                                return next
                              })
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <GitBranch className="size-3.5" />
                              {condition
                                ? (() => {
                                    const src = fields.find(f => f.id === condition.fieldId)
                                    if (!src) return tAI("conditionEditor.conditionSet")
                                    const opLabel = condition.operator === 'equals' ? '='
                                      : condition.operator === 'not_equals' ? '≠'
                                      : condition.operator === 'lte' ? '≤'
                                      : '≥'
                                    return `${tAI("conditionEditor.shownIf")} Q${src.order} ${opLabel} ${condition.value}`
                                  })()
                                : tAI("conditionEditor.addCondition")
                              }
                            </span>
                            <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Condition editor body */}
                          {isOpen && (
                            <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 space-y-3">

                              {/* Clear condition button */}
                              {condition && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCondition(field.id, null)}
                                  className="text-xs text-rose-500 hover:text-rose-600"
                                >
                                  {tAI("conditionEditor.removeCondition")}
                                </button>
                              )}

                              {/* Source question selector */}
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">
                                  {tAI("conditionEditor.showIfLabel")}
                                </Label>
                                <Select
                                  value={condition?.fieldId ?? ''}
                                  onValueChange={(val: any) => {
                                    if (!val) return
                                    const src = sources.find(s => s.id === val)
                                    if (!src) return
                                    handleUpdateCondition(field.id, {
                                      fieldId: String(val),
                                      operator: (src.type === 'star_rating' || src.type === 'numeric_scale') ? ('lte' as const) : ('equals' as const),
                                      value: src.type === 'star_rating' ? 3 : src.type === 'numeric_scale' ? 5 : (src.options[0] ?? ''),
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-700">
                                    <SelectValue placeholder={tAI("conditionEditor.pickQuestion")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sources.map(src => (
                                      <SelectItem key={src.id} value={src.id}>
                                        Q{src.order}: {src.label || '(untitled)'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Operator + value — only show once source is picked */}
                              {condition?.fieldId && (() => {
                                const src = fields.find(f => f.id === condition.fieldId)
                                if (!src || !condition) return null

                                const currentCond = condition

                                return (
                                  <div className="flex items-center gap-2">
                                    {/* Operator */}
                                    <Select
                                      value={currentCond.operator}
                                      onValueChange={(val: any) => {
                                        if (!val) return
                                        handleUpdateCondition(field.id, {
                                          ...currentCond,
                                          operator: val,
                                        })
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs w-24 border-slate-200 dark:border-slate-700">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {src.type === 'multiple_choice' ? (
                                          <>
                                            <SelectItem value="equals">{tAI("conditionEditor.operatorEquals")}</SelectItem>
                                            <SelectItem value="not_equals">{tAI("conditionEditor.operatorNotEquals")}</SelectItem>
                                          </>
                                        ) : (
                                          <>
                                            <SelectItem value="lte">{tAI("conditionEditor.operatorLte")}</SelectItem>
                                            <SelectItem value="gte">{tAI("conditionEditor.operatorGte")}</SelectItem>
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>

                                    {/* Value */}
                                    {src.type === 'multiple_choice' ? (
                                      <Select
                                        value={String(currentCond.value)}
                                        onValueChange={(val: any) => {
                                          if (!val) return
                                          handleUpdateCondition(field.id, {
                                            ...currentCond,
                                            value: String(val),
                                          })
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs flex-1 border-slate-200 dark:border-slate-700">
                                          <SelectValue placeholder={tAI("conditionEditor.pickOption")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {src.options.map((opt, i) => (
                                            <SelectItem key={i} value={opt}>
                                              {opt || `Option ${i + 1}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Select
                                        value={String(currentCond.value)}
                                        onValueChange={(val: any) => {
                                          if (!val) return
                                          handleUpdateCondition(field.id, {
                                            ...currentCond,
                                            value: Number(val),
                                          })
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-24 border-slate-200 dark:border-slate-700">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(src.type === 'star_rating' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(n => (
                                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Delete Button */}
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteQuestion(field.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50/30 rounded-lg size-9 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Touchpoint 2: Suggest Next Question Row */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isSuggestingNext}
              onClick={handleSuggestNextQuestion}
              className="w-full flex items-center justify-center gap-2 py-4 border border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl bg-indigo-50/10 hover:bg-indigo-50/30 dark:bg-indigo-950/5 dark:hover:bg-indigo-950/10 transition-colors disabled:opacity-50 group"
            >
              {isSuggestingNext ? (
                <>
                  <span className="animate-spin mr-1 text-indigo-500">🌀</span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {tAI("aiThinking")}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {tAI("aiSuggestNext")}
                  </span>
                </>
              )}
            </button>
            {aiSuggestNextError && (
              <p className="text-xs text-rose-500 font-medium mt-1 text-center">{aiSuggestNextError}</p>
            )}
          </div>
        </div>
      )}

      {/* Save Guard Warning Message */}
      {missingAr && (
        <p className="text-rose-600 text-sm mt-4 font-semibold text-center">
          ⚠️ {tAI("arabicPanel.missingSaveGuard")}
        </p>
      )}

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={onCancel}
          className="border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isSaving || !name.trim() || fields.length === 0 || missingAr}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
        >
          {isSaving ? tAI("savingLabel") : t("save")}
        </Button>
      </div>

      {/* Type C AI Form Generator Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {tAI("aiModal.title")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isAiModalGenerating) {
                    setIsAiModalOpen(false)
                    setShowAiConfirmReplace(false)
                  }
                }}
                disabled={isAiModalGenerating}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tAI("aiModal.subtitle")}
            </p>

            {showAiConfirmReplace ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {tAI("aiModal.replaceWarningTitle")}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {tAI("aiModal.replaceWarningMessage")}
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAiModalGenerating}
                    onClick={() => setShowAiConfirmReplace(false)}
                  >
                    {tAI("aiModal.cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isAiModalGenerating}
                    onClick={executeAiGeneration}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    {isAiModalGenerating ? (
                      <>
                        <Sparkles className="size-3.5 mr-1.5 animate-spin" />
                        {tAI("aiModal.generating")}
                      </>
                    ) : (
                      tAI("aiModal.confirmReplace")
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-desc-input" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {tAI("aiModal.descriptionLabel")} *
                  </Label>
                  <textarea
                    id="ai-desc-input"
                    value={aiModalDescription}
                    onChange={(e) => setAiModalDescription(e.target.value)}
                    placeholder={tAI("aiModal.descriptionPlaceholder")}
                    rows={3}
                    disabled={isAiModalGenerating}
                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 dark:border-slate-800 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {tAI("aiModal.countLabel")}
                  </Label>
                  <div className="flex items-center gap-3 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                      type="button"
                      onClick={() => setAiModalCountMode('number')}
                      disabled={isAiModalGenerating}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                        aiModalCountMode === 'number'
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {tAI("aiModal.countOptionNumber")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiModalCountMode('ai')}
                      disabled={isAiModalGenerating}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                        aiModalCountMode === 'ai'
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {tAI("aiModal.countOptionAi")}
                    </button>
                  </div>

                  {aiModalCountMode === 'number' && (
                    <div className="flex items-center gap-3 pt-1">
                      <Input
                        type="number"
                        min={3}
                        max={10}
                        value={aiModalQuestionCount}
                        onChange={(e) => setAiModalQuestionCount(Math.min(10, Math.max(3, parseInt(e.target.value) || 3)))}
                        disabled={isAiModalGenerating}
                        className="w-24 h-9 text-center font-semibold"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {tAI("aiModal.countRange")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isAiModalGenerating}
                    onClick={() => setIsAiModalOpen(false)}
                  >
                    {tAI("aiModal.cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={isAiModalGenerating || !aiModalDescription.trim()}
                    onClick={handleAiModalSubmitClick}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                  >
                    {isAiModalGenerating ? (
                      <>
                        <Sparkles className="size-4 mr-1.5 animate-spin" />
                        {tAI("aiModal.generating")}
                      </>
                    ) : (
                      tAI("aiModal.generate")
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM TURN OFF VISIT JOURNEY MODAL */}
      {showConfirmTurnOffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-amber-200 dark:border-amber-900 shadow-2xl bg-card rounded-2xl p-6 space-y-5">
            <div className="size-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-foreground">
                {tAI("confirmTurnOffTitle")}
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                {tAI("confirmTurnOffDesc")}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmTurnOffModal(false)}
                className="flex-1 h-10 text-xs font-semibold rounded-xl"
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmTurnOffVisitJourney}
                className="flex-1 h-10 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-md"
              >
                {tAI("confirmTurnOffBtn")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </form>
  )
}
