'use client'

import { useEffect, useRef } from 'react'
import { useMatchStore } from '@/store/matchStore'
import { Button } from '@/components/ui/button'
import type { Quarter } from '@/types'

export function Reloj() {
  const { clockSeconds, isClockRunning, quarter, setClockSeconds, toggleClock, setQuarter } = useMatchStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isClockRunning) {
      intervalRef.current = setInterval(() => {
        setClockSeconds(Math.max(0, useMatchStore.getState().clockSeconds - 1))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isClockRunning, setClockSeconds])

  const minutes = Math.floor(clockSeconds / 60)
  const seconds = clockSeconds % 60
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const quarters: Quarter[] = [1, 2, 3, 4, 'OT']

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="text-5xl font-mono font-bold text-primary tabular-nums">
        {display}
      </div>
      <div className="flex gap-1">
        {quarters.map((q) => (
          <button
            key={q}
            onClick={() => setQuarter(q)}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              quarter === q
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {q === 'OT' ? 'OT' : `Q${q}`}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={toggleClock}
          variant={isClockRunning ? 'destructive' : 'default'}
          size="sm"
          className="w-24"
        >
          {isClockRunning ? 'Pausar' : 'Iniciar'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setClockSeconds(600)}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
