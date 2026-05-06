"use client"

import { Trophy, Star, Eye, MapPin, Flame, Crown } from "lucide-react"

const badges = [
  { id: 1, name: "Pionero", icon: Trophy, color: "from-amber-500 to-yellow-400", description: "Primeros 100 usuarios" },
  { id: 2, name: "Top Reviewer", icon: Star, color: "from-primary to-orange-400", description: "50+ reseñas" },
  { id: 3, name: "Hidden Gem Finder", icon: Eye, color: "from-emerald-500 to-teal-400", description: "10 lugares secretos" },
  { id: 4, name: "Explorador", icon: MapPin, color: "from-blue-500 to-cyan-400", description: "20 ciudades" },
  { id: 5, name: "Streak Master", icon: Flame, color: "from-red-500 to-orange-400", description: "30 días activo" },
  { id: 6, name: "Elite", icon: Crown, color: "from-purple-500 to-pink-400", description: "Top 1%" },
]

export function BadgesShowcase() {
  return (
    <div className="px-4 py-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Insignias</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 bg-secondary/50 rounded-3xl min-w-[80px] hover:bg-secondary/80 transition-colors cursor-pointer group"
          >
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <badge.icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs text-foreground/80 font-medium text-center">{badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
