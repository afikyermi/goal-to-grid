'use client'

import { ActiveGoalProvider } from '@/lib/contexts/active-goal-context'

export function ActiveGoalWrapper({ children }: { children: React.ReactNode }) {
  return <ActiveGoalProvider>{children}</ActiveGoalProvider>
}
