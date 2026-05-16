'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Step = 'account' | 'household'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdAction, setHouseholdAction] = useState<'create' | 'join'>('create')
  const [householdName, setHouseholdName] = useState('')
  const [householdId, setHouseholdId] = useState('')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAccountStep(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Save the access token to send with household creation request
    setAccessToken(data.session?.access_token ?? null)
    setStep('household')
    setLoading(false)
  }

  async function handleHouseholdStep(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    if (householdAction === 'create') {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: householdName, display_name: displayName || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create household')
        setLoading(false)
        return
      }
    } else {
      const res = await fetch('/api/household', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ household_id: householdId.trim(), display_name: displayName || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to join household')
        setLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            {step === 'account' ? 'Step 1 of 2 — Your credentials' : 'Step 2 of 2 — Your household'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'account' ? (
            <form onSubmit={handleAccountStep} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display name (optional)</Label>
                <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Afik" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account…' : 'Continue'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleHouseholdStep} className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" variant={householdAction === 'create' ? 'default' : 'outline'} className="flex-1" onClick={() => setHouseholdAction('create')}>
                  Create new
                </Button>
                <Button type="button" variant={householdAction === 'join' ? 'default' : 'outline'} className="flex-1" onClick={() => setHouseholdAction('join')}>
                  Join existing
                </Button>
              </div>

              {householdAction === 'create' ? (
                <div className="space-y-2">
                  <Label htmlFor="hname">Household name</Label>
                  <Input id="hname" placeholder="e.g. The Yirmi Family" value={householdName} onChange={e => setHouseholdName(e.target.value)} required />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="hid">Household ID</Label>
                  <Input id="hid" placeholder="Paste the household UUID" value={householdId} onChange={e => setHouseholdId(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Ask your partner to share their Household ID from Settings.</p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Setting up…' : 'Finish setup'}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
