'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  currentRole: string
}

export default function AdminRoleButton({ userId, currentRole }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggleRole() {
    setLoading(true)
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleRole}
      disabled={loading}
    >
      {loading ? '...' : currentRole === 'admin' ? 'הסר אדמין' : 'הפוך לאדמין'}
    </Button>
  )
}
