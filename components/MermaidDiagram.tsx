'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  chart: string
}

export default function MermaidDiagram({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose' })
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, chart)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (error) return <p className="text-sm text-destructive">Diagram error: {error}</p>

  return <div ref={ref} className="flex justify-center overflow-auto" />
}
