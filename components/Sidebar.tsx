'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Columns3,
  LayoutDashboard,
  LogOut,
  Network,
  ShieldAlert,
  Users,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Workspace', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Columns3 },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/constraints', label: 'Constraints', icon: ShieldAlert },
  { href: '/admin/architecture', label: 'Architecture', icon: Network },
]

const adminItems = [
  { href: '/admin/users', label: 'User Admin', icon: Users },
]

interface Props {
  userEmail: string
  displayName: string
  householdName: string
  isAdmin: boolean
}

export default function Sidebar({ userEmail, displayName, householdName, isAdmin }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-4 border-b">
        <p className="font-bold text-lg">Goal-to-Grid</p>
        <p className="text-xs text-muted-foreground truncate">{householdName}</p>
      </div>

      <nav className="flex-1 overflow-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin</p>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{displayName || userEmail}</p>
          {isAdmin && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Admin</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
