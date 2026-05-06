"use client"

import { useState } from "react"
import { User, Salad } from "lucide-react"

const navItems = [
  { id: "home", icon: Salad, label: "Feedie" },
  { id: "profile", icon: User, label: "Perfil" },
]

interface BottomNavigationProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function BottomNavigation({ activeTab = "profile", onTabChange }: BottomNavigationProps) {
  const [active, setActive] = useState(activeTab)

  const handleTabClick = (id: string) => {
    setActive(id)
    onTabChange?.(id)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="bg-background/80 backdrop-blur-xl border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`relative flex flex-col items-center gap-1 py-2 px-4 rounded-2xl transition-all ${
                active === item.id 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <item.icon className={`w-6 h-6 transition-all ${active === item.id ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active === item.id && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Safe area spacer for iOS */}
      <div className="h-safe bg-background/80" />
    </nav>
  )
}
