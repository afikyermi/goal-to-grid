'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Clock } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

type BoardTask = { id: string; name: string; duration_min: number; priority: number; is_completed: boolean }
type BoardGoal = { id: string; name: string; start_date: string; end_date: string; priority: number; tasks: BoardTask[] | null }
type BoardSector = { id: string; name: string; goals: BoardGoal[] | null }

const priorityVariant: Record<number, 'destructive' | 'default' | 'secondary'> = { 1: 'destructive', 2: 'default', 3: 'secondary' }
const priorityLabel: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const priorityBorderL: Record<number, string> = {
  1: 'border-l-destructive',
  2: 'border-l-[var(--priority-medium)]',
  3: 'border-l-muted-foreground',
}

function formatShortDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return dateString
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
  return `${monthName} ${day}`
}

function goalDateWindow(goal: BoardGoal): string {
  return `${formatShortDate(goal.start_date)} - ${formatShortDate(goal.end_date)}`
}

function GoalCard({
  goal,
  isActive,
  onToggle,
}: {
  goal: BoardGoal
  isActive?: boolean | null
  onToggle: (taskId: string, completed: boolean) => void
}) {
  const [expanded, setExpanded] = useState(isActive !== false)

  const tasks = goal.tasks ?? []
  const completedCount = tasks.filter(t => t.is_completed).length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allDone = totalCount > 0 && completedCount === totalCount

  return (
    <div className={cn(
      'rounded-md border-l-2 border transition-colors duration-300',
      priorityBorderL[goal.priority],
      allDone ? 'border-primary/30 bg-primary/5' : 'bg-muted/20',
      isActive === true && 'ring-2 ring-primary ring-offset-1',
    )}>
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
            <p className={`text-sm font-medium leading-snug ${allDone ? 'text-muted-foreground line-through' : ''}`}>
              {goal.name}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {goal.priority === 1
                ? <span className="bg-destructive/10 text-destructive border border-destructive/30 rounded-full px-2 py-0.5 text-xs font-medium">High</span>
                : <Badge variant={priorityVariant[goal.priority]} className="text-xs">{priorityLabel[goal.priority]}</Badge>
              }
              <span className="bg-muted/50 text-muted-foreground text-xs px-2 py-0.5 rounded-full font-mono">
                {goalDateWindow(goal)}
              </span>
            </div>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="mt-3 ml-6 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {completedCount} / {totalCount} tasks done
              </span>
              <span className={`font-mono tabular-nums ${progress === 100 ? 'font-semibold text-primary' : ''}`}>
                {progress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${progress === 100 ? 'bg-[var(--status-done)]' : 'bg-primary'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      {expanded && tasks.length > 0 && (
        <div className="space-y-1 px-3 pb-3">
          {[...tasks].sort((a, b) => a.priority - b.priority).map((task, idx) => (
            <button
              key={task.id}
              type="button"
              style={{ animationDelay: `${idx * 35}ms` }}
              className={cn(
                'ao-slide-up flex w-full items-center gap-3 rounded border px-2 py-2 text-left text-xs',
                'transition-[background-color,transform,border-color] duration-150',
                task.is_completed
                  ? 'border-muted bg-muted/30 text-muted-foreground opacity-80 cursor-default'
                  : 'bg-background hover:bg-muted/30 hover:border-primary/30 hover:-translate-y-px active:translate-y-0',
              )}
              onClick={() => onToggle(task.id, !task.is_completed)}
            >
              {task.is_completed
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-done)] transition-all duration-100" />
                : <Circle className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-100" />}
              <span className={cn(
                'flex-1 truncate transition-all duration-500',
                task.is_completed ? 'line-through' : '',
              )}>
                {task.name}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground font-mono text-[11px] bg-muted/50 rounded px-1">
                <Clock className="h-3 w-3" />{formatDuration(task.duration_min)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DomainBoard({
  sectors,
  activeGoalId,
  onToggle,
}: {
  sectors: BoardSector[]
  activeGoalId?: string | null
  onToggle: (taskId: string, completed: boolean) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {sectors.map(sector => {
        const goals = [...(sector.goals ?? [])].sort((a, b) => {
          const byEndDate = new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          return byEndDate || a.priority - b.priority
        })
        return (
          <div key={sector.id} className="rounded-lg border border-primary/15 bg-[oklch(0.94_0.025_235)] p-3 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3 -mx-3 -mt-3 px-3 py-2 rounded-t-lg bg-[oklch(0.91_0.035_235)] border-b border-primary/15">
              <p className="font-semibold">{sector.name}</p>
              <Badge className="font-mono tabular-nums bg-primary/15 text-primary border border-primary/20 hover:bg-primary/15">{goals.length} goals</Badge>
            </div>
            <div className="space-y-2">
              {goals.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No goals yet.</div>
              ) : (
                goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    isActive={activeGoalId ? (goal.id === activeGoalId ? true : false) : null}
                    onToggle={onToggle}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
