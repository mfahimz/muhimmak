"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Megaphone, Plus, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface Announcement {
  id: string
  slug: string
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  image_url: string | null
  min_score_threshold: number
  is_active: boolean
  created_at: string
}

interface AnnouncementsClientProps {
  initialAnnouncements: Announcement[]
}

export function AnnouncementsClient({ initialAnnouncements }: AnnouncementsClientProps) {
  const t = useTranslations("Announcements")
  const [announcements, setAnnouncements] = React.useState<Announcement[]>(initialAnnouncements)
  
  // Sheet state
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = React.useState({
    slug: "",
    title_en: "",
    title_ar: "",
    body_en: "",
    body_ar: "",
    min_score_threshold: 60,
    image_url: "" as string | null
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  // Dialog states
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  const [activateWarningId, setActivateWarningId] = React.useState<string | null>(null)
  const [isToggling, setIsToggling] = React.useState(false)

  const supabase = createClient()

  const resetForm = () => {
    setFormData({
      slug: "",
      title_en: "",
      title_ar: "",
      body_en: "",
      body_ar: "",
      min_score_threshold: 60,
      image_url: null
    })
    setFormError(null)
    setEditingId(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsSheetOpen(true)
  }

  const handleOpenEdit = (ann: Announcement) => {
    setFormData({
      slug: ann.slug,
      title_en: ann.title_en,
      title_ar: ann.title_ar,
      body_en: ann.body_en,
      body_ar: ann.body_ar,
      min_score_threshold: ann.min_score_threshold,
      image_url: ann.image_url
    })
    setEditingId(ann.id)
    setFormError(null)
    setIsSheetOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setFormError(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('announcement-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('announcement-images')
        .getPublicUrl(fileName)

      setFormData(prev => ({ ...prev, image_url: data.publicUrl }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errorUploadImage")
      setFormError(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setFormError(null)
    try {
      const isUpdate = !!editingId
      const url = isUpdate ? `/api/v1/announcements/${editingId}` : '/api/v1/announcements'
      const method = isUpdate ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || t("errorSaveAnnouncement"))
      }

      if (isUpdate) {
        setAnnouncements(prev => prev.map(a => a.id === editingId ? { ...a, ...data.announcement } : a))
      } else {
        setAnnouncements(prev => [data.announcement, ...prev])
      }
      
      setIsSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errorSaveAnnouncement")
      setFormError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/v1/announcements/${deleteId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || t("errorDeleteAnnouncement"))
      }
      setAnnouncements(prev => prev.filter(a => a.id !== deleteId))
      setDeleteId(null)
    } catch {
      // Deletion handled
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (currentStatus) {
      // Deactivating is safe
      await toggleStatusAPI(id, false)
      return
    }

    // Activating requires warning if another is active
    const currentlyActive = announcements.find(a => a.is_active)
    if (currentlyActive) {
      setActivateWarningId(id)
    } else {
      await toggleStatusAPI(id, true)
    }
  }

  const toggleStatusAPI = async (id: string, newStatus: boolean) => {
    setIsToggling(true)
    try {
      const response = await fetch(`/api/v1/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || t("errorUpdateAnnouncement"))
      }
      
      setAnnouncements(prev => prev.map(a => {
        if (a.id === id) return { ...a, is_active: newStatus, updated_at: new Date().toISOString() }
        if (newStatus && a.id !== id) return { ...a, is_active: false }
        return a
      }))
    } catch {
      // Toggle error handled
    } finally {
      setIsToggling(false)
      setActivateWarningId(null)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("listTitle")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t("listSubtitle")}
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="size-4" />
          <span>{t("createNew")}</span>
        </Button>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-0">
          {announcements.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
              <Megaphone className="size-12 stroke-[1.25] text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">{t("noAnnouncements")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">{t("colTitle")}</th>
                    <th className="px-4 py-3.5">{t("colSlug")}</th>
                    <th className="px-4 py-3.5">{t("colMinScore")}</th>
                    <th className="px-4 py-3.5">{t("colStatus")}</th>
                    <th className="px-4 py-3.5 text-right">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {announcements.map((ann) => (
                    <tr key={ann.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                        {ann.title_en}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">{ann.slug}</td>
                      <td className="px-4 py-3.5">{ann.min_score_threshold}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={ann.is_active} 
                            onCheckedChange={() => handleToggleActive(ann.id, ann.is_active)}
                            disabled={isToggling}
                          />
                          {ann.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(ann)}>
                          <Pencil className="size-3.5 mr-1.5" />
                          {t("edit")}
                        </Button>
                        <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteId(ann.id)}>
                          <Trash2 className="size-3.5 mr-1.5" />
                          {t("delete")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto w-full">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingId ? t("editTitle") : t("createTitle")}</SheetTitle>
            <SheetDescription>{t("formDescription")}</SheetDescription>
          </SheetHeader>

          {formError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-2">
              <AlertCircle className="size-4" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">{t("slug")}</Label>
              <Input 
                id="slug" 
                value={formData.slug} 
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="e.g. new-feature-launch"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title_en">{t("titleEn")}</Label>
                <Input 
                  id="title_en" 
                  value={formData.title_en} 
                  onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title_ar">{t("titleAr")}</Label>
                <Input 
                  id="title_ar" 
                  value={formData.title_ar} 
                  onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))}
                  dir="rtl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="body_en">{t("bodyEn")}</Label>
                <textarea 
                  id="body_en" 
                  value={formData.body_en} 
                  onChange={(e) => setFormData(prev => ({ ...prev, body_en: e.target.value }))}
                  className="w-full flex min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body_ar">{t("bodyAr")}</Label>
                <textarea 
                  id="body_ar" 
                  value={formData.body_ar} 
                  onChange={(e) => setFormData(prev => ({ ...prev, body_ar: e.target.value }))}
                  dir="rtl"
                  className="w-full flex min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_score_threshold">{t("minScore")}</Label>
              <Input 
                id="min_score_threshold" 
                type="number"
                value={formData.min_score_threshold} 
                onChange={(e) => setFormData(prev => ({ ...prev, min_score_threshold: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>{t("image")}</Label>
              <div className="flex items-center gap-4">
                {formData.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.image_url} alt="Preview" className="h-16 w-16 object-cover rounded-md border" />
                )}
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </div>
                {isUploading && <Loader2 className="size-4 animate-spin text-indigo-600" />}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isUploading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Warning */}
      <AlertDialog open={!!activateWarningId} onOpenChange={(open) => !open && setActivateWarningId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("activateWarningTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("activateWarningDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { 
                e.preventDefault(); 
                if (activateWarningId) toggleStatusAPI(activateWarningId, true);
              }} 
              disabled={isToggling}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isToggling ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {t("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
