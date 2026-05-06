'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Star, MapPin, Trophy, Crown, Medal,
  TrendingUp, Users, Clock, Heart, Share2,
  Sparkles, ChefHat, Coffee, DollarSign,
  Moon, Briefcase, Wine, Sandwich, Zap,
  ArrowUp, CheckCircle2, Camera, Edit3, Ghost,
  ThumbsUp, Eye, Award
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Warm Night: deep warm browns + orange accent

const glass = 'bg-white/[0.06] backdrop-blur-md border border-white/[0.08]'
const glassDark = 'bg-black/30 backdrop-blur-md border border-white/[0.06]'
const card = `${glass} rounded-[28px]`

// ─── Fake QR pattern (CSS-based) ─────────────────────────────────────────────

function FakeQR() {
  const pattern = [
    [1,1,1,0,1,0,1,1,1],
    [1,0,1,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1],
    [0,0,0,1,0,1,0,0,0],
    [1,1,0,0,1,0,0,1,1],
    [0,0,1,1,0,1,1,0,0],
    [1,0,1,0,1,0,1,0,1],
    [1,0,0,1,0,1,0,0,1],
    [1,1,1,0,1,0,1,1,1],
  ]
  return (
    <div className="grid gap-[1.5px]" style={{ gridTemplateColumns: 'repeat(9,8px)' }}>
      {pattern.flat().map((v, i) => (
        <div key={i} className={`w-2 h-2 rounded-[1px] ${v ? 'bg-orange-400' : 'bg-transparent'}`} />
      ))}
    </div>
  )
}

// =============================================================================
// 1. AI EDITOR & AUTO-TAGGING
// =============================================================================

const SUGGEST_MAP: Record<string, { icon: string; label: string; color: string }[]> = {
  sushi:    [{ icon:'🍣', label:'Japonés',    color:'bg-violet-500/20 text-violet-300 border-violet-500/30' }],
  japonés:  [{ icon:'🍣', label:'Japonés',    color:'bg-violet-500/20 text-violet-300 border-violet-500/30' }],
  ruid:     [{ icon:'🔇', label:'Ruidoso',    color:'bg-red-500/20 text-red-300 border-red-500/30' }],
  tranquil: [{ icon:'🔈', label:'Tranquilo',  color:'bg-green-500/20 text-green-300 border-green-500/30' }],
  econom:   [{ icon:'💸', label:'Económico',  color:'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }],
  barato:   [{ icon:'💸', label:'Económico',  color:'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }],
  vegano:   [{ icon:'🌱', label:'Vegano',     color:'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }],
  veg:      [{ icon:'🥗', label:'Vegetariano',color:'bg-lime-500/20 text-lime-300 border-lime-500/30' }],
  picada:   [{ icon:'🏆', label:'Picada',     color:'bg-orange-500/20 text-orange-300 border-orange-500/30' }],
  familia:  [{ icon:'👨‍👩‍👧', label:'Familiar', color:'bg-blue-500/20 text-blue-300 border-blue-500/30' }],
  romantico:[{ icon:'🌹', label:'Romántico',  color:'bg-pink-500/20 text-pink-300 border-pink-500/30' }],
}

function AIEditor() {
  const [text, setText]         = useState('')
  const [tags, setTags]         = useState<typeof SUGGEST_MAP[string]>([])
  const [addedTags, setAddedTags] = useState<string[]>([])
  const [points, setPoints]     = useState(0)
  const [hint, setHint]         = useState('')

  useEffect(() => {
    const lower = text.toLowerCase()
    const found: typeof SUGGEST_MAP[string] = []
    Object.entries(SUGGEST_MAP).forEach(([key, val]) => {
      if (lower.includes(key)) val.forEach(t => {
        if (!found.find(f => f.label === t.label)) found.push(t)
      })
    })
    setTags(found.filter(t => !addedTags.includes(t.label)))

    // Dynamic hints
    if (text.length < 10) setHint('Escribe al menos 10 caracteres para publicar.')
    else if (text.length < 30) setHint('¡Buen comienzo! Agrega más detalles para ganar +5 pts extra.')
    else if (text.length >= 30 && text.length < 60) setHint('Vas muy bien 🔥 Agrega una etiqueta para +3 pts.')
    else setHint('¡Reseña completa! Lista para publicar.')

    setPoints(
      Math.min(20,
        Math.floor(text.length / 5) +
        addedTags.length * 3
      )
    )
  }, [text, addedTags])

  const addTag = (tag: typeof SUGGEST_MAP[string][number]) => {
    setAddedTags(p => [...p, tag.label])
    setTags(p => p.filter(t => t.label !== tag.label))
  }

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Edit3 className="size-4 text-blue-400" />
          </div>
          <p className="font-semibold text-white/90 text-sm">Editor con IA</p>
        </div>
        <motion.div
          key={points}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-full px-2.5 py-1"
        >
          <Zap className="size-3 text-orange-400" />
          <span className="text-xs font-bold text-orange-300">+{points} pts</span>
        </motion.div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe tu experiencia en este local..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 text-sm text-white/80 placeholder:text-white/25 resize-none h-28 focus:outline-none focus:border-orange-500/40 transition-colors"
        />
        {text.length > 0 && (
          <div className="absolute bottom-3 right-3 text-[10px] text-white/30">{text.length}</div>
        )}
      </div>

      {/* AI hint */}
      <AnimatePresence mode="wait">
        {hint && (
          <motion.div
            key={hint}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 bg-white/[0.04] rounded-xl px-3 py-2"
          >
            <Sparkles className="size-3.5 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-white/50">{hint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggested tags */}
      <AnimatePresence>
        {tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
              IA detectó — toca para agregar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <motion.button
                  key={tag.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => addTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${tag.color} flex items-center gap-1`}
                >
                  {tag.icon} {tag.label} <span className="opacity-60">+3</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Added tags */}
      {addedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addedTags.map(t => (
            <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-300 border border-orange-500/25 flex items-center gap-1">
              <CheckCircle2 className="size-2.5" /> {t}
            </span>
          ))}
        </div>
      )}

      <button className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
        disabled={text.length < 10}>
        Publicar reseña
      </button>
    </div>
  )
}

// =============================================================================
// 2. CROMO COLECCIONABLE
// =============================================================================

function CollectibleCard() {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Award className="size-4 text-yellow-400" />
        </div>
        <p className="font-semibold text-white/90 text-sm">Cromo Coleccionable</p>
        <span className="ml-auto text-[10px] text-white/30">Toca el cromo</span>
      </div>

      <div className="flex justify-center" style={{ perspective: 900 }}>
        <motion.div
          className="relative cursor-pointer"
          style={{ width: 200, height: 290, transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          onClick={() => setFlipped(v => !v)}
        >
          {/* FRONT */}
          <div className="absolute inset-0 rounded-[28px] overflow-hidden"
            style={{ backfaceVisibility: 'hidden' }}>
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/80 via-amber-950/90 to-stone-900" />
            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
            {/* Border glow */}
            <div className="absolute inset-0 rounded-[28px] border-2 border-orange-500/40" />

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-orange-400 tracking-widest">PICADA.APP</span>
                <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                  EDICIÓN ESPECIAL
                </span>
              </div>

              {/* Dish image area */}
              <div className="flex-1 rounded-2xl bg-gradient-to-br from-orange-800/40 to-amber-900/40 border border-orange-500/20 mb-3 flex items-center justify-center">
                <div className="text-6xl">🍣</div>
              </div>

              {/* Name */}
              <p className="text-white font-black text-sm leading-tight mb-0.5">Don Osaka</p>
              <p className="text-white/40 text-[10px] mb-3">Providencia, Santiago</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[
                  { label: 'SCORE', value: '94' },
                  { label: 'RATING', value: '4.8' },
                  { label: 'PRECIO', value: '$$' },
                ].map(s => (
                  <div key={s.label} className="bg-black/30 rounded-xl p-1.5 text-center">
                    <p className="text-orange-400 font-black text-sm">{s.value}</p>
                    <p className="text-white/30 text-[8px] tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Badge */}
              <div className="flex items-center justify-center gap-1.5 bg-orange-500/20 rounded-xl py-1.5 border border-orange-500/30">
                <Trophy className="size-3 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-300">Descubridor #1</span>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="absolute inset-0 rounded-[28px] overflow-hidden"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-amber-950/80 to-orange-900/40" />
            <div className="absolute inset-0 rounded-[28px] border-2 border-orange-500/30" />
            <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4 p-5">
              <span className="text-[9px] font-black text-orange-400 tracking-widest">PICADA.APP</span>
              <FakeQR />
              <p className="text-[10px] text-white/40 text-center">
                Escanea para ver el local<br />en Picada.APP
              </p>
              <div className="w-full bg-black/30 rounded-2xl p-3 space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/30">DESCUBIERTO POR</span>
                  <span className="text-orange-300 font-bold">@claudio_g</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/30">FECHA</span>
                  <span className="text-white/50">27 Abr 2026</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/30">SERIAL</span>
                  <span className="text-white/30 font-mono">#PCK-0042</span>
                </div>
              </div>
              <button className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5">
                <Share2 className="size-3 text-orange-400" />
                <span className="text-[10px] text-orange-300 font-semibold">Compartir cromo</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// =============================================================================
// 3. DASHBOARD DE DUEÑO
// =============================================================================

function OwnerDashboard() {
  const PENDING = 47
  const COMMUNITY = 4.7
  const OFFICIAL  = 4.2

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <ChefHat className="size-4 text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-white/90 text-sm">Vista del Dueño</p>
          <p className="text-[10px] text-white/30">Don Osaka · Providencia</p>
        </div>
        <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          Activo
        </span>
      </div>

      {/* Radar de pendientes */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white/70">Radar de Pendientes</p>
          <span className="text-[10px] text-white/30">Esta semana</span>
        </div>
        <div className="flex items-end gap-3">
          <motion.div
            className="text-4xl font-black text-orange-400"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {PENDING}
          </motion.div>
          <div className="pb-1">
            <p className="text-xs text-white/50">personas planean visitarte</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ArrowUp className="size-3 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">+12 vs semana pasada</span>
            </div>
          </div>
        </div>
        {/* Mini bar chart */}
        <div className="flex items-end gap-1 h-12">
          {[18,22,15,30,25,40,47].map((v, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-md bg-orange-500/40"
              initial={{ height: 0 }}
              animate={{ height: `${(v / 47) * 100}%` }}
              transition={{ delay: 0.1 * i, type: 'spring', stiffness: 200 }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-white/20">
          {['L','M','X','J','V','S','D'].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>

      {/* Rating comparison */}
      <div className="bg-white/[0.04] rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-white/70">Rating Comunidad vs Oficial</p>
        {[
          { label: 'Comunidad Picada', value: COMMUNITY, color: 'bg-orange-500', textColor: 'text-orange-400' },
          { label: 'Google Maps',      value: OFFICIAL,  color: 'bg-white/20',   textColor: 'text-white/50' },
        ].map(r => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[11px] text-white/50">{r.label}</span>
              <span className={`text-[11px] font-bold ${r.textColor}`}>{r.value} ★</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${r.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / 5) * 100}%` }}
                transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
          <TrendingUp className="size-3" />
          La comunidad te valora un 11.9% más que Google
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Eye,       value: '1.2K', label: 'Visitas perfil' },
          { icon: Heart,     value: '89',   label: 'Favoritos' },
          { icon: Camera,    value: '34',   label: 'Fotos subidas' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.04] rounded-2xl p-3 text-center space-y-1">
            <s.icon className="size-4 text-white/30 mx-auto" />
            <p className="text-sm font-bold text-white/80">{s.value}</p>
            <p className="text-[9px] text-white/30 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// 4. LEADERBOARD — Duelos por Comuna
// =============================================================================

const RANKERS = [
  { rank: 1, name: '@ana_picada',   commune: 'Providencia', points: 4820, emoji: '👑', badge: 'Reina' },
  { rank: 2, name: '@carlos_f',     commune: 'Ñuñoa',       points: 3610, emoji: '🥈', badge: 'Crítico' },
  { rank: 3, name: '@marta_ch',     commune: 'Las Condes',  points: 3290, emoji: '🥉', badge: 'Explorador' },
  { rank: 4, name: '@pepe_m',       commune: 'Maipú',       points: 2180, emoji: '🔥', badge: 'Picador' },
  { rank: 5, name: '@sofi_g',       commune: 'La Florida',  points: 1940, emoji: '⭐', badge: 'Foodie' },
]

function Leaderboard() {
  const [period, setPeriod] = useState<'semana' | 'mes'>('semana')

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Trophy className="size-4 text-yellow-400" />
        </div>
        <p className="font-semibold text-white/90 text-sm">Reyes de la Picada</p>
        <div className="ml-auto flex bg-white/[0.06] rounded-full p-0.5 gap-0.5">
          {(['semana','mes'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors capitalize ${
                period === p
                  ? 'bg-orange-500 text-white'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      <div className="flex items-end justify-center gap-2 pb-1">
        {[RANKERS[1], RANKERS[0], RANKERS[2]].map((r, i) => {
          const heights = [52, 68, 44]
          const sizes   = [10, 14, 10]
          return (
            <motion.div
              key={r.rank}
              className="flex flex-col items-center gap-1.5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-2xl">{r.emoji}</div>
              <div
                className={`w-${sizes[i]} flex items-end justify-center rounded-t-2xl text-[10px] font-bold text-white/60`}
                style={{
                  height: heights[i],
                  background: i === 1
                    ? 'linear-gradient(to top, rgba(249,115,22,0.5), rgba(249,115,22,0.15))'
                    : 'rgba(255,255,255,0.05)',
                  borderTop: i === 1 ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  width: sizes[i] * 4,
                }}
              >
                <span className="pb-2">#{r.rank}</span>
              </div>
              <p className="text-[9px] text-white/50 text-center max-w-[56px] leading-tight">{r.name}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Full list */}
      <div className="space-y-2">
        {RANKERS.map((r, i) => (
          <motion.div
            key={r.rank}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${
              r.rank === 1
                ? 'bg-orange-500/10 border border-orange-500/20'
                : 'bg-white/[0.03] border border-white/[0.04]'
            }`}
          >
            <span className="text-lg w-6 text-center">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-white/80">{r.name}</p>
                <span className="text-[9px] bg-white/[0.06] text-white/30 px-1.5 py-0.5 rounded-full">{r.badge}</span>
              </div>
              <p className="text-[10px] text-white/30">{r.commune}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-orange-400">{r.points}</p>
              <p className="text-[9px] text-white/25">pts</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// 5. MOOD DISCOVERY
// =============================================================================

const MOODS = [
  { id: 'pobre',     emoji: '💸', label: 'Ando Pobre',      color: 'from-yellow-500/20 to-amber-500/10',  border: 'border-yellow-500/25' },
  { id: 'cita',      emoji: '🌹', label: 'Cita Romántica',  color: 'from-pink-500/20 to-rose-500/10',     border: 'border-pink-500/25' },
  { id: 'resaca',    emoji: '🍹', label: 'Resaca',          color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/25' },
  { id: 'postpega',  emoji: '💼', label: 'Post-Pega',       color: 'from-blue-500/20 to-sky-500/10',      border: 'border-blue-500/25' },
  { id: 'familiar',  emoji: '👨‍👩‍👧', label: 'Familiar',      color: 'from-emerald-500/20 to-green-500/10', border: 'border-emerald-500/25' },
  { id: 'noche',     emoji: '🌆', label: 'Tardecita',       color: 'from-indigo-500/20 to-violet-500/10', border: 'border-indigo-500/25' },
  { id: 'chill',     emoji: '😌', label: 'Chill',           color: 'from-teal-500/20 to-cyan-500/10',     border: 'border-teal-500/25' },
  { id: 'antojado',  emoji: '🔥', label: 'Me Antojé',       color: 'from-orange-500/20 to-red-500/10',    border: 'border-orange-500/25' },
]

const MOOD_RESULTS: Record<string, { name: string; score: number; tag: string }[]> = {
  pobre:    [{ name:'El Mechero', score:91, tag:'$' }, { name:'La Fuente', score:87, tag:'$' }, { name:'Rico Pan', score:83, tag:'$' }],
  cita:     [{ name:'Noi Bistró', score:96, tag:'$$$' }, { name:'Osso', score:94, tag:'$$$' }, { name:'Le Flaubert', score:90, tag:'$$$$' }],
  resaca:   [{ name:'El Completo', score:89, tag:'$' }, { name:'La Rampa', score:85, tag:'$' }, { name:'Don Burger', score:82, tag:'$$' }],
  postpega: [{ name:'Galindo', score:92, tag:'$$' }, { name:'La Piojera', score:88, tag:'$' }, { name:'El Otro', score:85, tag:'$$' }],
  familiar: [{ name:'Tip Top', score:90, tag:'$$' }, { name:'Damasco', score:87, tag:'$$' }, { name:'La Batuta', score:84, tag:'$$' }],
  noche:    [{ name:'Bar The Clinic', score:93, tag:'$$' }, { name:'Flannery\'s', score:89, tag:'$$' }, { name:'La Fábrica', score:86, tag:'$$' }],
  chill:    [{ name:'La Castrina', score:95, tag:'$$' }, { name:'Café Melba', score:91, tag:'$$' }, { name:'Of Course', score:88, tag:'$$' }],
  antojado: [{ name:'Fuente Alemana', score:97, tag:'$$' }, { name:'La Vega', score:93, tag:'$' }, { name:'Don Pollo', score:90, tag:'$$' }],
}

function MoodDiscovery() {
  const [active, setActive] = useState('antojado')
  const results = MOOD_RESULTS[active] ?? []
  const activeMood = MOODS.find(m => m.id === active)!

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Sparkles className="size-4 text-orange-400" />
        </div>
        <div>
          <p className="font-semibold text-white/90 text-sm">Mood Discovery</p>
          <p className="text-[10px] text-white/30">¿Cómo te sientes hoy?</p>
        </div>
      </div>

      {/* Mood pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {MOODS.map(m => (
          <motion.button
            key={m.id}
            onClick={() => setActive(m.id)}
            whileTap={{ scale: 0.94 }}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border transition-all ${
              active === m.id
                ? `bg-gradient-to-b ${m.color} ${m.border} shadow-lg`
                : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]'
            }`}
          >
            <span className="text-2xl leading-none">{m.emoji}</span>
            <span className={`text-[9px] font-semibold whitespace-nowrap ${
              active === m.id ? 'text-white/80' : 'text-white/30'
            }`}>{m.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-2"
        >
          <p className="text-[11px] text-white/30">
            Locales perfectos para <span className="text-white/60 font-semibold">"{activeMood.label}"</span>
          </p>
          {results.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 bg-white/[0.04] rounded-2xl px-4 py-3 border border-white/[0.04]"
            >
              <div className="size-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center text-lg">
                🏠
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/80">{r.name}</p>
                <p className="text-[10px] text-white/30">{r.tag} · Santiago</p>
              </div>
              <div className="flex items-center gap-1 bg-orange-500/15 rounded-full px-2.5 py-1">
                <Flame className="size-3 text-orange-400" />
                <span className="text-[11px] font-bold text-orange-400">{r.score}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// PAGE
// =============================================================================

export default function DesignLab() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0f0a06 0%, #1a0e07 40%, #0f0a06 100%)' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/[0.06]"
        style={{ background: 'rgba(15,10,6,0.85)' }}>
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-black text-white/90 text-base tracking-tight">Picada.APP</p>
            <p className="text-[10px] text-orange-400 font-medium">Design Lab — Warm Night</p>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1.5">
            <Sparkles className="size-3 text-orange-400" />
            <span className="text-[11px] text-orange-300 font-semibold">Madurez UX</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        <SectionTitle num="01" label="AI Editor & Auto-Tagging" />
        <AIEditor />

        <SectionTitle num="02" label="Cromo Coleccionable" />
        <CollectibleCard />

        <SectionTitle num="03" label="Dashboard del Dueño" />
        <OwnerDashboard />

        <SectionTitle num="04" label="Leaderboard — Duelos por Comuna" />
        <Leaderboard />

        <SectionTitle num="05" label="Mood Discovery" />
        <MoodDiscovery />

        <div className="h-8" />
      </div>
    </div>
  )
}

function SectionTitle({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[10px] font-black text-orange-500/60 tracking-widest">{num}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )
}
