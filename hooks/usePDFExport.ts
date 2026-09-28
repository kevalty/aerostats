'use client'

import { useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import { MatchReport } from '@/components/match/MatchReport'
import { useMatchStore } from '@/store/matchStore'
import React from 'react'

export function usePDFExport() {
  const { events, players, teamHome, teamAway, quarter } = useMatchStore()

  const exportPDF = useCallback(async () => {
    const homeScore = events
      .filter((e) => {
        const p = players.find((pl) => pl.id === e.player_id)
        return p?.team_id === teamHome?.id
      })
      .reduce((s, e) => s + e.calculated_points, 0)

    const awayScore = events
      .filter((e) => {
        const p = players.find((pl) => pl.id === e.player_id)
        return p?.team_id === teamAway?.id
      })
      .reduce((s, e) => s + e.calculated_points, 0)

    const doc = React.createElement(MatchReport, {
      events,
      players,
      teamHome: teamHome!,
      teamAway: teamAway!,
      homeScore,
      awayScore,
      quarter,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arostats-${teamHome?.nombre}-vs-${teamAway?.nombre}-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [events, players, teamHome, teamAway, quarter])

  return { exportPDF }
}
