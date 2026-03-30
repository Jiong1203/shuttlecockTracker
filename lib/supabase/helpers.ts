import { SupabaseClient } from '@supabase/supabase-js'

export async function getGroupId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  return profile?.group_id ?? null
}
