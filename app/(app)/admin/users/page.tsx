import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AdminRoleButton from '@/components/AdminRoleButton'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify current user is admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') redirect('/dashboard')

  // Fetch all profiles with their household
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at, household_id, households(name)')
    .order('created_at')

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
        <p className="text-sm text-muted-foreground">כל המשתמשים הרשומים במערכת</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>משתמשים ({profiles?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>Household</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>נרשם</TableHead>
                <TableHead>פעולה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map(p => {
                const household = p.households as unknown as { name: string } | null
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.display_name ?? <span className="text-muted-foreground">ללא שם</span>}
                      {p.id === user.id && <span className="ml-2 text-xs text-muted-foreground">(אתה)</span>}
                    </TableCell>
                    <TableCell>{household?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'}>
                        {p.role === 'admin' ? 'אדמין' : 'משתמש'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('he-IL')}
                    </TableCell>
                    <TableCell>
                      {p.id !== user.id && (
                        <AdminRoleButton
                          userId={p.id}
                          currentRole={p.role}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
