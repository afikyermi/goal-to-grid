'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

type BoardTask = { id: string; name: string; duration_min: number; priority: number; is_completed: boolean }
type BoardGoal = { id: string; name: string; start_date: string; end_date: string; priority: number; tasks: BoardTask[] | null }
type BoardSector = { id: string; name: string; goals: BoardGoal[] | null }

const priorityVariant: Record<number, 'destructive' | 'default' | 'secondary'> = { 1: 'destructive', 2: 'default', 3: 'secondary' }
const priorityLabel: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function goalDateWindow(goal: BoardGoal): string {
  return `${formatShortDate(goal.start_date)} - ${formatShortDate(goal.end_date)}`
}

function GoalCard({ goal }: { goal: BoardGoal }) {
  const [tasks, setTasks] = useState<BoardTask[]>(goal.tasks ?? [])
  const [expanded, setExpanded] = useState(true)

  const completedCount = tasks.filter(t => t.is_completed).length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allDone = totalCount > 0 && completedCount === totalCount

  const toggleTask = useCallback(async (taskId: string, current: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !current } : t))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !current }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: current } : t))
    }
  }, [])

  return (
    <div className={`rounded-md border transition-colors ${allDone ? 'border-primary/30 bg-primary/5' : 'bg-muted/20'}`}>
      <button
        type="button"
        className="w-full p-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-2">
          {expanded
            ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-snug ${allDone ? 'text-muted-foreground line-through' : ''}`}>{goal.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant={priorityVariant[goal.priority]} className="text-xs">{priorityLabel[goal.priority]}</Badge>
              <Badge variant="outline" className="text-xs">{goalDateWindow(goal)}</Badge>
            </div>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="mt-3 ml-6 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} / {totalCount} tasks done</span>
              <span className={progress === 100 ? 'font-semibold text-primary' : ''}>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-primary' : 'bg-primary/60'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      {expanded && tasks.length > 0 && (
        <div className="space-y-1 px-3 pb-3">
          {[...tasks].sort((a, b) => a.priority - b.priority).map(task => (
            <button
              key={task.id}
              type="button"
              className={`flex w-full items-center gap-3 rounded border px-2 py-2 text-left text-xs transition-colors ${
                task.is_completed
                  ? 'border-muted bg-muted/30 text-muted-foreground'
                  : 'bg-background hover:bg-muted/30'
              }`}
              onClick={() => toggleTask(task.id, task.is_completed)}
            >
              {task.is_completed
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className={`flex-1 truncate ${task.is_completed ? 'line-through' : ''}`}>{task.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />{formatDuration(task.duration_min)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DomainBoard({ sectors }: { sectors: BoardSector[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {sectors.map(sector => {
        const goals = [...(sector.goals ?? [])].sort((a, b) => {
          const byEndDate = new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          return byEndDate || a.priority - b.priority
        })
        return (
          <div key={sector.id} className="rounded-lg border bg-background p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="font-semibold">{sector.name}</p>
              <Badge variant="secondary">{goals.length} goals</Badge>
            </div>
            <div className="space-y-2">
              {goals.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No goals yet.</div>
              ) : (
                goals.map(goal => <GoalCard key={goal.id} goal={goal} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
