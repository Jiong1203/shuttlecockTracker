import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { GroupSettingsForm } from "@/components/group-settings-form"

async function getGroupSettings() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("groups(name, contact_email)")
    .eq("id", session.user.id)
    .single()

  const groups = profile?.groups as { name: string; contact_email: string | null } | { name: string; contact_email: string | null }[] | null
  const group = Array.isArray(groups) ? groups[0] : groups

  return {
    name: group?.name ?? "",
    contactEmail: group?.contact_email ?? "",
  }
}

export default async function SettingsPage() {
  const { name, contactEmail } = await getGroupSettings()

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 頁首 */}
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            球團帳號設定
          </h1>
          <p className="text-sm text-muted-foreground">管理球團名稱、共享密碼、通知信箱與 LINE 綁定等設定。</p>
        </div>

        {/* 設定表單 */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <GroupSettingsForm initialGroupName={name} initialContactEmail={contactEmail} />
        </div>
      </div>
    </div>
  )
}
