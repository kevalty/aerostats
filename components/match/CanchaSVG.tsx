'use client'

import { useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useMatchStore } from '@/store/matchStore'
import type { EventType } from '@/types'

// Court dimensions (SVG coordinate space)
const COURT_W = 470
const COURT_H = 280

// 2pt zone: roughly the key/paint area + close range
// Returns true if the shot is a 2-pointer based on position
function is2Pointer(x: number, y: number): boolean {
  const cx = COURT_W / 2
  const cy = COURT_H / 2
  // Arc: ~6.75m radius in NBA. In our SVG space: ~130px from basket
  const basketX = cx
  const basketY = cy
  const dist = Math.sqrt((x - basketX) ** 2 + (y - basketY) ** 2)
  // Also check if behind the 3pt line corners (within 90px from sideline)
  const inCorner = y < 40 || y > COURT_H - 40
  return dist < 130 && !inCorner
}

function calculatePoints(x: number, y: number): number {
  return is2Pointer(x, y) ? 2 : 3
}

type Props = {
  onEventRegistered?: (eventType: EventType, points: number, x: number, y: number) => void
}

function DroppableCourt({ children, onDrop }: { children: React.ReactNode; onDrop: (x: number, y: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'court' })
  return (
    <div
      ref={setNodeRef}
      className={`relative ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      {children}
    </div>
  )
}

export function CanchaSVG({ onEventRegistered }: Props) {
  const { interactionMode, selectedPlayerId, selectPlayer, addEvent, matchId, players } = useMatchStore()

  const handleCourtClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (interactionMode !== 'taptap' || !selectedPlayerId) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * COURT_W
    const y = ((e.clientY - rect.top) / rect.height) * COURT_H
    const points = calculatePoints(x, y)
    const eventType: EventType = points === 2 ? 'canasta_2' : 'canasta_3'

    if (!matchId) return
    addEvent({
      match_id: matchId,
      player_id: selectedPlayerId,
      event_type: eventType,
      coord_x: Math.round(x),
      coord_y: Math.round(y),
      calculated_points: points,
      timestamp: new Date().toISOString(),
    })
    onEventRegistered?.(eventType, points, x, y)
    selectPlayer(null)
  }, [interactionMode, selectedPlayerId, matchId, addEvent, selectPlayer, onEventRegistered])

  return (
    <DroppableCourt onDrop={() => {}}>
      <svg
        viewBox={`0 0 ${COURT_W} ${COURT_H}`}
        className={`w-full court-container select-none ${
          interactionMode === 'taptap' && selectedPlayerId ? 'cursor-crosshair' : ''
        }`}
        onClick={handleCourtClick}
        style={{ touchAction: 'none' }}
      >
        {/* Court background */}
        <rect x="0" y="0" width={COURT_W} height={COURT_H} fill="#8B4513" rx="4" />
        <rect x="4" y="4" width={COURT_W - 8} height={COURT_H - 8} fill="none" stroke="#DEB887" strokeWidth="2" rx="2" />

        {/* Center line */}
        <line x1={COURT_W / 2} y1="4" x2={COURT_W / 2} y2={COURT_H - 4} stroke="#DEB887" strokeWidth="1.5" />

        {/* Center circle */}
        <circle cx={COURT_W / 2} cy={COURT_H / 2} r="36" fill="none" stroke="#DEB887" strokeWidth="1.5" />

        {/* Left key / paint */}
        <rect x="4" y={COURT_H / 2 - 60} width="120" height="120" fill="rgba(222,184,135,0.15)" stroke="#DEB887" strokeWidth="1.5" />
        {/* Left free throw circle */}
        <circle cx="124" cy={COURT_H / 2} r="36" fill="none" stroke="#DEB887" strokeWidth="1.5" />
        {/* Left basket */}
        <circle cx="28" cy={COURT_H / 2} r="8" fill="none" stroke="#F59E0B" strokeWidth="2" />
        <circle cx="28" cy={COURT_H / 2} r="2" fill="#F59E0B" />
        {/* Left 3pt arc */}
        <path d={`M 4 ${COURT_H / 2 - 90} L 90 ${COURT_H / 2 - 90} A 130 130 0 0 1 90 ${COURT_H / 2 + 90} L 4 ${COURT_H / 2 + 90}`}
          fill="none" stroke="#DEB887" strokeWidth="1.5" />

        {/* Right key / paint */}
        <rect x={COURT_W - 124} y={COURT_H / 2 - 60} width="120" height="120" fill="rgba(222,184,135,0.15)" stroke="#DEB887" strokeWidth="1.5" />
        {/* Right free throw circle */}
        <circle cx={COURT_W - 124} cy={COURT_H / 2} r="36" fill="none" stroke="#DEB887" strokeWidth="1.5" />
        {/* Right basket */}
        <circle cx={COURT_W - 28} cy={COURT_H / 2} r="8" fill="none" stroke="#F59E0B" strokeWidth="2" />
        <circle cx={COURT_W - 28} cy={COURT_H / 2} r="2" fill="#F59E0B" />
        {/* Right 3pt arc */}
        <path d={`M ${COURT_W - 4} ${COURT_H / 2 - 90} L ${COURT_W - 90} ${COURT_H / 2 - 90} A 130 130 0 0 0 ${COURT_W - 90} ${COURT_H / 2 + 90} L ${COURT_W - 4} ${COURT_H / 2 + 90}`}
          fill="none" stroke="#DEB887" strokeWidth="1.5" />

        {/* Shot dots from events */}
        {useMatchStore.getState().events
          .filter((e) => (e.event_type === 'canasta_2' || e.event_type === 'canasta_3') && e.coord_x != null)
          .map((e) => (
            <circle
              key={e.id}
              cx={e.coord_x}
              cy={e.coord_y}
              r="5"
              fill={e.event_type === 'canasta_3' ? '#3B82F6' : '#22C55E'}
              opacity="0.8"
              stroke="white"
              strokeWidth="1"
            />
          ))
        }

        {/* Taptap instruction overlay */}
        {interactionMode === 'taptap' && !selectedPlayerId && (
          <text
            x={COURT_W / 2}
            y={COURT_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="14"
            fontFamily="sans-serif"
          >
            Selecciona un jugador
          </text>
        )}
        {interactionMode === 'taptap' && selectedPlayerId && (
          <text
            x={COURT_W / 2}
            y={COURT_H - 16}
            textAnchor="middle"
            fill="rgba(245,158,11,0.8)"
            fontSize="12"
            fontFamily="sans-serif"
          >
            Toca la cancha para registrar el tiro
          </text>
        )}
      </svg>
    </DroppableCourt>
  )
}
