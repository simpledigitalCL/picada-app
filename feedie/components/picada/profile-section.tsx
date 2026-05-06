"use client"

import { Award, MessageCircle, Share2, UserPlus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const stats = [
  { label: "Seguidores", value: "12.4K" },
  { label: "Siguiendo", value: "892" },
  { label: "Picada Points", value: "8,750", icon: Sparkles },
]

const moodTags = ["#AndoPobre", "#CitaRomántica", "#FoodieWeekend", "#StreetFood"]

export function ProfileSection() {
  return (
    <div className="px-4 py-6">
      {/* Avatar & Badge */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-primary via-orange-400 to-yellow-500">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop"
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-4 border-background"
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-orange-400 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-primary/30">
            <Award className="w-3 h-3" />
            Pro Critic
          </div>
        </div>

        {/* Name & Username */}
        <h1 className="mt-6 text-xl font-semibold text-foreground">Alejandro Ruiz</h1>
        <p className="text-muted-foreground text-sm">@alex_foodie</p>

        {/* Stats Row */}
        <div className="flex gap-8 mt-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {stat.icon && <stat.icon className="w-4 h-4 text-primary" />}
                <span className="text-lg font-semibold text-foreground">{stat.value}</span>
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Bio */}
        <p className="mt-4 text-center text-sm text-foreground/80 max-w-xs leading-relaxed">
          Explorando sabores únicos en cada rincón de la ciudad. Crítico gastronómico con 5+ años de experiencia.
        </p>

        {/* Mood Tags */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {moodTags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 w-full max-w-xs">
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-full h-11 font-medium">
            <UserPlus className="w-4 h-4 mr-2" />
            Seguir
          </Button>
          <Button variant="secondary" className="rounded-full h-11 w-11 p-0 bg-secondary hover:bg-secondary/80">
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button variant="secondary" className="rounded-full h-11 px-4 bg-secondary hover:bg-secondary/80 font-medium">
            <Share2 className="w-4 h-4 mr-2" />
            Pasaporte
          </Button>
        </div>
      </div>
    </div>
  )
}
