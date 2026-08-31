import { createClient } from '@supabase/supabase-js'
import { inferMissingQuestionDomains } from '../src/server/services/forms.service'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

const db = createClient(url, key)
const { data: forms, error } = await db.from('forms').select('id, fields')
if (error) throw error

for (const form of forms || []) {
  const fields = Array.isArray(form.fields) ? form.fields : []
  if (!fields.some((field: any) => !field.domain)) continue
  const updatedFields = await inferMissingQuestionDomains(fields)
  const result = await db.from('forms').update({ fields: updatedFields, updated_at: new Date().toISOString() }).eq('id', form.id)
  if (result.error) throw result.error
  console.log(`Updated form ${form.id}`)
}

console.log('Question domain backfill complete')
