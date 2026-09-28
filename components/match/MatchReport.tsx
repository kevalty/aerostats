import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { MatchEvent, Player, Team, Quarter } from '@/types'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 6,
    marginBottom: 24,
  },
  teamBlock: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 40,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  vs: {
    fontSize: 16,
    color: '#9CA3AF',
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  table: {
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 6,
  },
  cell: {
    fontSize: 10,
    color: '#374151',
    flex: 1,
  },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
  },
  cellNarrow: {
    flex: 0.5,
  },
  cellWide: {
    flex: 2,
  },
})

const EVENT_LABELS: Record<string, string> = {
  canasta_2: 'Canasta 2pts',
  canasta_3: 'Canasta 3pts',
  tiro_libre: 'Tiro Libre',
  falta: 'Falta',
  tiempo_fuera: 'Tiempo Fuera',
  robo: 'Robo',
  bloqueo: 'Bloqueo',
  rebote: 'Rebote',
}

type Props = {
  events: MatchEvent[]
  players: Player[]
  teamHome: Team
  teamAway: Team
  homeScore: number
  awayScore: number
  quarter: Quarter
}

function PlayerStats({
  team,
  events,
  players,
}: {
  team: Team
  events: MatchEvent[]
  players: Player[]
}) {
  const teamPlayers = players.filter((p) => p.team_id === team.id)
  const teamEvents = events.filter((e) => {
    const p = players.find((pl) => pl.id === e.player_id)
    return p?.team_id === team.id
  })

  const statsMap = teamPlayers.reduce(
    (acc, p) => {
      const pEvents = teamEvents.filter((e) => e.player_id === p.id)
      acc[p.id] = {
        player: p,
        puntos: pEvents.reduce((s, e) => s + e.calculated_points, 0),
        canastas2: pEvents.filter((e) => e.event_type === 'canasta_2').length,
        canastas3: pEvents.filter((e) => e.event_type === 'canasta_3').length,
        libres: pEvents.filter((e) => e.event_type === 'tiro_libre').length,
        faltas: pEvents.filter((e) => e.event_type === 'falta').length,
        robos: pEvents.filter((e) => e.event_type === 'robo').length,
        rebotes: pEvents.filter((e) => e.event_type === 'rebote').length,
      }
      return acc
    },
    {} as Record<string, {
      player: Player; puntos: number; canastas2: number; canastas3: number;
      libres: number; faltas: number; robos: number; rebotes: number
    }>
  )

  return (
    <View style={styles.table}>
      <Text style={styles.sectionTitle}>{team.nombre}</Text>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.cell, styles.cellBold, styles.cellNarrow]}>#</Text>
        <Text style={[styles.cell, styles.cellBold, styles.cellWide]}>Jugador</Text>
        <Text style={[styles.cell, styles.cellBold]}>Pts</Text>
        <Text style={[styles.cell, styles.cellBold]}>2P</Text>
        <Text style={[styles.cell, styles.cellBold]}>3P</Text>
        <Text style={[styles.cell, styles.cellBold]}>TL</Text>
        <Text style={[styles.cell, styles.cellBold]}>F</Text>
        <Text style={[styles.cell, styles.cellBold]}>Rob</Text>
        <Text style={[styles.cell, styles.cellBold]}>Reb</Text>
      </View>
      {Object.values(statsMap)
        .sort((a, b) => b.puntos - a.puntos)
        .map(({ player, puntos, canastas2, canastas3, libres, faltas, robos, rebotes }) => (
          <View key={player.id} style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellNarrow]}>{player.numero_camiseta}</Text>
            <Text style={[styles.cell, styles.cellWide]}>{player.nombre}</Text>
            <Text style={[styles.cell, styles.cellBold]}>{puntos}</Text>
            <Text style={styles.cell}>{canastas2}</Text>
            <Text style={styles.cell}>{canastas3}</Text>
            <Text style={styles.cell}>{libres}</Text>
            <Text style={styles.cell}>{faltas}</Text>
            <Text style={styles.cell}>{robos}</Text>
            <Text style={styles.cell}>{rebotes}</Text>
          </View>
        ))}
    </View>
  )
}

export function MatchReport({ events, players, teamHome, teamAway, homeScore, awayScore, quarter }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>AroStats — Resumen de Partido</Text>
        <Text style={styles.subtitle}>
          Generado el {new Date().toLocaleDateString('es-ES')} · Cuarto/Periodo: {quarter}
        </Text>

        <View style={styles.scoreRow}>
          <View style={styles.teamBlock}>
            <Text style={styles.teamName}>{teamHome.nombre}</Text>
            <Text style={styles.scoreText}>{homeScore}</Text>
          </View>
          <Text style={styles.vs}>vs</Text>
          <View style={styles.teamBlock}>
            <Text style={styles.teamName}>{teamAway.nombre}</Text>
            <Text style={styles.scoreText}>{awayScore}</Text>
          </View>
        </View>

        <PlayerStats team={teamHome} events={events} players={players} />
        <PlayerStats team={teamAway} events={events} players={players} />

        <Text style={styles.sectionTitle}>Registro de Eventos ({events.length})</Text>
        {events.slice(-30).map((e) => {
          const player = players.find((p) => p.id === e.player_id)
          return (
            <View key={e.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellNarrow]}>
                {new Date(e.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
              <Text style={[styles.cell, styles.cellWide]}>
                {player ? `#${player.numero_camiseta} ${player.nombre}` : '—'}
              </Text>
              <Text style={styles.cell}>{EVENT_LABELS[e.event_type] ?? e.event_type}</Text>
              {e.calculated_points > 0 && (
                <Text style={[styles.cell, styles.cellBold]}>+{e.calculated_points}</Text>
              )}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
