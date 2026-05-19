'use client'

import { createContext, useContext, useState } from 'react'

type ActiveGoalContextValue = {
  activeGoalId: string | null
  setActiveGoalId: (id: string | null) => void
}

const ActiveGoalContext = createContext<ActiveGoalContextValue>({
  activeGoalId: null,
  setActiveGoalId: () => {},
})

export function ActiveGoalProvider({ children }: { children: React.ReactNode }) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null)
  return (
    <ActiveGoalContext.Provider value={{ activeGoalId, setActiveGoalId }}>
      {children}
    </ActiveGoalContext.Provider>
  )
}

export function useActiveGoal() {
  return useContext(ActiveGoalContext)
}
