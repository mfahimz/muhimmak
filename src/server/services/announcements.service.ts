'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export interface AnnouncementForRender {
  slug: string
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  image_url: string | null
}

export async function getActiveAnnouncementForSession(
  sessionId: string,
  plateNumberHash: string | null | undefined,
  score: number
): Promise<AnnouncementForRender | null> {
  if (!plateNumberHash) {
    console.warn(`[announcements] Missing plate_number_hash for session ${sessionId}`)
    return null
  }

  const admin = createAdminClient()

  const { data: announcement, error: announcementError } = await admin
    .from('announcements')
    .select('id, slug, title_en, title_ar, body_en, body_ar, image_url, min_score_threshold')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (announcementError || !announcement) {
    return null
  }

  if (score <= announcement.min_score_threshold) {
    return null
  }

  const { data: existingView, error: viewError } = await admin
    .from('announcement_views')
    .select('id')
    .eq('announcement_id', announcement.id)
    .eq('plate_number_hash', plateNumberHash)
    .maybeSingle()

  if (viewError) {
    console.error('[announcements] Failed to check existing view:', viewError)
    return null
  }

  if (existingView) {
    return null
  }

  const { error: insertError } = await admin
    .from('announcement_views')
    .insert({
      announcement_id: announcement.id,
      plate_number_hash: plateNumberHash,
      session_id: sessionId,
    })

  if (insertError) {
    console.error('[announcements] Failed to insert announcement_views:', insertError)
    return null
  }

  return {
    slug: announcement.slug,
    title_en: announcement.title_en,
    title_ar: announcement.title_ar,
    body_en: announcement.body_en,
    body_ar: announcement.body_ar,
    image_url: announcement.image_url,
  }
}

export interface AnnouncementInput {
  slug: string
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  image_url?: string | null
  min_score_threshold?: number
  is_active?: boolean
}

export type AnnouncementUpdateInput = Partial<AnnouncementInput>

// Admin CRUD Operations

export async function getAllAnnouncements() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function createAnnouncement(payload: AnnouncementInput) {
  const admin = createAdminClient();
  
  // If setting to active, we must deactivate the currently active one first
  if (payload.is_active) {
    const { error: deactivateError } = await admin
      .from('announcements')
      .update({ is_active: false })
      .eq('is_active', true);
    
    if (deactivateError) {
      throw new Error(deactivateError.message);
    }
  }

  const titleEn = (payload.title_en || '').trim();
  const titleAr = (payload.title_ar || '').trim() || titleEn;
  const bodyEn = (payload.body_en || '').trim();
  const bodyAr = (payload.body_ar || '').trim() || bodyEn;
  const slug = (payload.slug || '').trim()
    || titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    || `announcement-${Date.now()}`;
  const imageUrl = payload.image_url && payload.image_url.trim() !== '' ? payload.image_url.trim() : null;
  const minScore = typeof payload.min_score_threshold === 'number' ? payload.min_score_threshold : (parseInt(String(payload.min_score_threshold), 10) || 60);

  const insertPayload = {
    slug,
    title_en: titleEn,
    title_ar: titleAr,
    body_en: bodyEn,
    body_ar: bodyAr,
    image_url: imageUrl,
    min_score_threshold: minScore,
    is_active: Boolean(payload.is_active),
  };

  const { data, error } = await admin
    .from('announcements')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateAnnouncement(id: string, payload: AnnouncementUpdateInput) {
  const admin = createAdminClient();
  
  // If setting to active, we must deactivate the currently active one first
  if (payload.is_active) {
    const { error: deactivateError } = await admin
      .from('announcements')
      .update({ is_active: false })
      .eq('is_active', true)
      .neq('id', id);
      
    if (deactivateError) {
      throw new Error(deactivateError.message);
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.title_en !== undefined) updateData.title_en = payload.title_en.trim();
  if (payload.title_ar !== undefined) updateData.title_ar = payload.title_ar.trim() || (payload.title_en || '').trim();
  if (payload.body_en !== undefined) updateData.body_en = payload.body_en.trim();
  if (payload.body_ar !== undefined) updateData.body_ar = payload.body_ar.trim() || (payload.body_en || '').trim();
  if (payload.slug !== undefined) updateData.slug = payload.slug.trim();
  if (payload.min_score_threshold !== undefined) {
    updateData.min_score_threshold = typeof payload.min_score_threshold === 'number'
      ? payload.min_score_threshold
      : (parseInt(String(payload.min_score_threshold), 10) || 60);
  }
  if (payload.image_url !== undefined) {
    updateData.image_url = payload.image_url && payload.image_url.trim() !== '' ? payload.image_url.trim() : null;
  }
  if (payload.is_active !== undefined) {
    updateData.is_active = Boolean(payload.is_active);
  }

  const { data, error } = await admin
    .from('announcements')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function deleteAnnouncement(id: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
  return true;
}


