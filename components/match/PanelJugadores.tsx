'use client'

import { useDraggable } from '@dnd-kit/core'
import { useMatchStore } from '@/store/matchStore'
import { Badge } from '@/components/ui/badge'
import type { Player } from '@/types'

function DraggablePlayer({ player, isSelected }: { player: Player; isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: player.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-grab active:cursor-grabbing ${
        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 hover:bg-muted/60'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <Badge variant="secondary" className="font-mono text-xs w-7 justify-center p-0">{player.numero_camiseta}</Badge>
      <span className="truncate max-w-[80px]">{player.nombre.split(' ')[0]}</span>
    </div>
  )
}

function TaptapPlayer({ player, isSelected, onSelect }: { player: Player; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm font-medium transition-colors w-full text-left ${
        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 hover:bg-muted/60'
      }`}
    >
      <Badge variant="secondary" className="font-mono text-xs w-7 justify-center p-0">{player.numero_camiseta}</Badge>
      <span className="truncate max-w-[80px]">{player.nombre.split(' ')[0]}</span>
    </button>
  )
}

type Props = {
  teamId: string
  teamName: string
  teamColor?: string
}

export function PanelJugadores({ teamId, teamName, teamColor }: Props) {
  const { players, selectedPlayerId, interactionMode, selectPlayer } = useMatchStore()
  const teamPlayers = players.filter((p) => p.team_id === teamId)

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        {teamColor && (
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: teamColor }} />
        )}
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {teamName}
        </h3>
      </div>
      <div className="space-y-1">
        {teamPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sin jugadores</p>
        ) : (
          teamPlayers.map((player) =>
            interactionMode === 'dnd' ? (
              <DraggablePlayer
                key={player.id}
                player={player}
                isSelected={selectedPlayerId === player.id}
              />
            ) : (
              <TaptapPlayer
                key={player.id}
                player={player}
                isSelected={selectedPlayerId === player.id}
                onSelect={() => selectPlayer(selectedPlayerId === player.id ? null : player.id)}
              />
            )
          )
        )}
      </div>
    </div>
  )
}
