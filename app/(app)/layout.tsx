import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/app-shell"

async function getGroup() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("groups(name, contact_email)")
    .eq("id", session.user.id)
    .single()

  const groups = profile?.groups as { name: string; contact_email: string | null } | { name: string; contact_email: string | null }[] | null
  const group = Array.isArray(groups) ? groups[0] : groups
  if (!group) return null

  return { name: group.name ?? "", contactEmail: group.contact_email ?? "" }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const group = await getGroup()
  return <AppShell group={group}>{children}</AppShell>
}
