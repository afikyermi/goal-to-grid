'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetupHouseholdPage() {
  const [action, setAction] = useState<'create' | 'join'>('create')
  const [householdName, setHouseholdName] = useState('')
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const body = action === 'create'
      ? { action: 'create', name: householdName }
      : { action: 'join', household_id: householdId.trim() }

    const res = await fetch('/api/setup-household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    // Full navigation so the server layout re-reads fresh profile data
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set up your household</CardTitle>
          <CardDescription>Your account needs to be linked to a household before you can continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={action === 'create' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAction('create')}
              >
                Create new
              </Button>
              <Button
                type="button"
                variant={action === 'join' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAction('join')}
              >
                Join existing
              </Button>
            </div>

            {action === 'create' ? (
              <div className="space-y-2">
                <Label htmlFor="hname">Household name</Label>
                <Input
                  id="hname"
                  placeholder="e.g. The Yirmi Family"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="hid">Household ID</Label>
                <Input
                  id="hid"
                  placeholder="Paste the household UUID"
                  value={householdId}
                  onChange={e => setHouseholdId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Ask your partner to share their Household ID from Settings.</p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up…' : 'Finish setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
