import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export const S = {
  async get(k) {
    try {
      const { data, error } = await supabase
        .from('qa_storage')
        .select('value')
        .eq('key', k)
        .single()
      if (error || !data) return null
      return data.value
    } catch { return null }
  },
  async set(k, v) {
    try {
      const { error } = await supabase
        .from('qa_storage')
        .upsert({ key: k, value: v, updated_at: new Date().toISOString() })
      return !error
    } catch { return false }
  },
}
