"use client"

import { useState } from "react"
import { Plus, X, Camera, Star, MapPin } from "lucide-react"

const actions = [
  { id: "story", icon: Camera, label: "Quick Story", color: "from-pink-500 to-rose-500" },
  { id: "review", icon: Star, label: "Expert Review", color: "from-amber-500 to-yellow-500" },
  { id: "picada", icon: MapPin, label: "New Picada", color: "from-emerald-500 to-teal-500" },
]

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {/* Action Menu */}
      <div className={`flex flex-col-reverse gap-3 mb-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {actions.map((action, index) => (
          <button
            key={action.id}
            style={{ transitionDelay: `${index * 50}ms` }}
            className={`flex items-center gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
          >
            <span className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-foreground shadow-lg whitespace-nowrap">
              {action.label}
            </span>
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
          </button>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 ${isOpen ? 'rotate-45 scale-90' : 'rotate-0 scale-100'}`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  )
}
