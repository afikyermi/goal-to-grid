'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

export default function RunSchedulerButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRun() {
    setStatus('running')
    setMessage('')
    // Default window: today → +7 days. Tasks must be selected on the Schedule page for full control.
    // Here we trigger the reschedule (self-healing) endpoint as a quick action.
    const res = await fetch('/api/schedule/reschedule', { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setStatus('done')
      setMessage(json.message)
    } else {
      setStatus('error')
      setMessage(json.error ?? 'Failed')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleRun} disabled={status === 'running'}>
        <Zap className="h-4 w-4 mr-2" />
        {status === 'running' ? 'Rescheduling…' : 'Self-heal missed tasks'}
      </Button>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
