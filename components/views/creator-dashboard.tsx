'use client'

import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Users, ShieldCheck, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  locationQuery: string
  influencePoints: number
  recommendationsClicks: number
  inspectorLevel: string
  topDiscovery?: string
}

function makeShareImage(summary: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const grad = ctx.createLinearGradient(0, 0, 1080, 1920)
  grad.addColorStop(0, '#14161a')
  grad.addColorStop(1, '#1f2937')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1080, 1920)

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(90, 420, 900, 620)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 64px sans-serif'
  ctx.fillText('Picada.APP', 130, 520)
  ctx.font = '36px sans-serif'
  ctx.fillText(summary, 130, 620)
  ctx.fillText('Comparte tu descubrimiento en Stories', 130, 690)

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = 'picada-share-card.png'
  a.click()
}

export function CreatorDashboard({
  locationQuery,
  influencePoints,
  recommendationsClicks,
  inspectorLevel,
  topDiscovery,
}: Props) {
  const rank = useMemo(() => {
    if (recommendationsClicks > 120) return '#1'
    if (recommendationsClicks > 80) return '#2'
    if (recommendationsClicks > 40) return '#3'
    return '#7'
  }, [recommendationsClicks])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-3"
    >
      <Card className="border-white/15 bg-white/10 backdrop-blur-xl shadow-xl rounded-3xl">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Mi Impacto</p>
            <Badge className="rounded-full bg-emerald-600 text-white">Nivel {inspectorLevel}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Comieron por ti" value={String(recommendationsClicks)} icon={Users} />
            <Metric label="Puntos Influencia" value={String(influencePoints)} icon={TrendingUp} />
            <Metric label={`Ranking ${locationQuery}`} value={rank} icon={ShieldCheck} />
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
            <p className="text-xs text-muted-foreground">Visual de compartir</p>
            <p className="text-sm font-semibold mt-1">
              {topDiscovery ? `Tu hallazgo destacado: ${topDiscovery}` : 'Comparte tu última recomendación'}
            </p>
            <Button
              size="sm"
              className="mt-2 rounded-2xl"
              onClick={() => makeShareImage(`Descubrí ${topDiscovery || 'una picada brutal'} en ${locationQuery}`)}
            >
              <Download className="size-4 mr-1.5" />
              Descargar para Stories
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-2.5">
      <Icon className="size-4 text-orange-400" />
      <p className="text-sm font-bold mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

