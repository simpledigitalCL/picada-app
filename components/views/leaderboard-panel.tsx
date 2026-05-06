'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { loadPoints } from '@/lib/gamification/core'
import { loadProfileSocialSettings } from '@/lib/feed/personalization'
import { getOrCreateIdentity } from '@/lib/auth/identity'

// Datos semilla — muestran cómo lucirá el leaderboard real con auth
const SEED_CRITICS = [
  { username: 'gourmet_stgo',   pts: 4820, emoji: '👑', zona: 'Providencia' },
  { username: 'picada_hunter',  pts: 3150, emoji: '🔍', zona: 'Santiago Centro' },
  { username: 'foodie_bsas',    pts: 2490, emoji: '🔍', zona: 'Ñuñoa' },
  { username: 'sushi_lover_cl', pts: 1870, emoji: '🍽️', zona: 'Las Condes' },
  { username: 'vegano_vibes',   pts: 1340, emoji: '🍽️', zona: 'Bellavista' },
]

const RANK_COLORS = ['text-yellow-500', 'text-slate-400', 'text-amber-600']
const RANK_EMOJI  = ['🥇', '🥈', '🥉']

interface Props {
  locationQuery: string
}

export function LeaderboardPanel({ locationQuery }: Props) {
  const userPts  = loadPoints()
  const social   = loadProfileSocialSettings()
  const username = social.username || getOrCreateIdentity().username || 'tú'
  const [remoteEntries, setRemoteEntries] = useState<Array<{ username: string; pts: number; emoji: string; zona: string; isMe: boolean }>>([])

  useEffect(() => {
    let active = true
    fetch('/api/leaderboard?limit=20')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('request_failed'))))
      .then((payload: { items?: Array<{ user_id: string; username: string; final_score: number; consistency_score?: number }> }) => {
        if (!active) return
        const me = getOrCreateIdentity()
        const list = (payload.items || []).map(item => ({
          username: item.username || 'foodie',
          pts: Number(item.final_score || 0),
          emoji: '🍽️',
          zona: Number(item.consistency_score || 0) >= 24 ? '🏆 Top de la semana' : (locationQuery || 'Comunidad'),
          isMe: item.user_id === me.userId,
        }))
        setRemoteEntries(list)
      })
      .catch(() => {
        if (!active) return
        setRemoteEntries([])
      })

    return () => {
      active = false
    }
  }, [locationQuery])

  const entries = useMemo(() => {
    const userEntry = { username, pts: userPts, emoji: '🧭', zona: locationQuery || 'Tu zona', isMe: true }
    const source = remoteEntries.length > 0 ? remoteEntries : [...SEED_CRITICS.map(c => ({ ...c, isMe: false })), userEntry]
    const hasMe = source.some(e => e.isMe || e.username === username)
    const all = (hasMe ? source : [...source, userEntry]).sort((a, b) => b.pts - a.pts)

    // Rank
    return all.map((e, i) => ({ ...e, rank: i + 1 }))
  }, [userPts, username, locationQuery, remoteEntries])

  const myEntry = entries.find(e => e.isMe)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="size-4 text-yellow-500" aria-hidden />
            Top críticos de tu zona
          </CardTitle>
          <Badge variant="secondary" className="text-xs">Esta semana</Badge>
        </div>
        {locationQuery && (
          <p className="text-xs text-muted-foreground">{locationQuery}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {entries.slice(0, 6).map(entry => (
          <div
            key={entry.username}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              entry.isMe
                ? 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800'
                : 'bg-muted/40'
            }`}
          >
            <span className={`text-base font-bold w-5 text-center shrink-0 ${RANK_COLORS[entry.rank - 1] ?? 'text-muted-foreground'}`}>
              {RANK_EMOJI[entry.rank - 1] ?? `#${entry.rank}`}
            </span>
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="text-xs">{entry.emoji}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${entry.isMe ? 'text-orange-700 dark:text-orange-400' : ''}`}>
                @{entry.username} {entry.isMe && <span className="text-xs font-normal">(tú)</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">{entry.zona}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{entry.pts.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
        ))}

        {myEntry && myEntry.rank > 6 && (
          <>
            <div className="text-center text-xs text-muted-foreground py-1">· · ·</div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <span className="text-base font-bold w-5 text-center shrink-0 text-muted-foreground">#{myEntry.rank}</span>
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-xs">{myEntry.emoji}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-orange-700 dark:text-orange-400">@{myEntry.username} <span className="text-xs font-normal">(tú)</span></p>
                <p className="text-[10px] text-muted-foreground">{myEntry.zona}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{myEntry.pts.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">XP</p>
              </div>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {remoteEntries.length > 0 ? 'Ranking en tiempo real por eventos' : 'Mostrando ranking semilla/local mientras se sincroniza'}
        </p>
      </CardContent>
    </Card>
  )
}
