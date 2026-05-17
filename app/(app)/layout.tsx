import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'

type AppProfile = {
  display_name: string | null
  household_id: string | null
  role: string | null
  households: { name: string } | null
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Use the user-scoped client only for auth verification
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Use admin client to read the profile — bypasses RLS so we never get a
  // false null due to a policy gap (e.g. household_id just written by upsert)
  const admin = createAdminClient()
  let { data: profile } = await admin
    .from('profiles')
    .select('display_name, household_id, role, households(name)')
    .eq('id', user.id)
    .single<AppProfile>()

  if (!profile?.household_id) {
    const fallbackName = profile?.display_name
      ?? user.user_metadata?.display_name
      ?? user.email?.split('@')[0]
      ?? 'My'

    const { data: household } = await admin
      .from('households')
      .insert({ name: `${fallbackName}'s Workspace` })
      .select('id')
      .single()

    if (household?.id) {
      await admin
        .from('profiles')
        .upsert({
          id: user.id,
          household_id: household.id,
          display_name: profile?.display_name ?? user.user_metadata?.display_name ?? null,
          role: profile?.role ?? 'member',
        })

      const refreshed = await admin
        .from('profiles')
        .select('display_name, household_id, role, households(name)')
        .eq('id', user.id)
        .single<AppProfile>()

      profile = refreshed.data
    }
  }

  if (!profile?.household_id) redirect('/setup-household')

  const householdName = (profile?.households as unknown as { name: string } | null)?.name ?? 'No household'
  const displayName = profile?.display_name ?? user.email ?? ''
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        userEmail={user.email ?? ''}
        displayName={displayName}
        householdName={householdName}
        isAdmin={isAdmin}
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
