"use client"

import { Search, Compass, Bell, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

// Vectorized Picada flame icon
function FlameIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2C12 2 7 7 7 12C7 14.5 8 16.5 9.5 18C9 16.5 9 15 10 13.5C10.5 12.75 11.5 12 12 11C12.5 12 13.5 12.75 14 13.5C15 15 15 16.5 14.5 18C16 16.5 17 14.5 17 12C17 7 12 2 12 2Z" 
        fill="url(#flame-gradient)"
      />
      <path 
        d="M12 22C9.5 22 7.5 20 7.5 17.5C7.5 15.5 8.5 14 10 13C10 14.5 10.5 15.5 11 16C11.5 16.5 12 17 12 18C12 17 12.5 16.5 13 16C13.5 15.5 14 14.5 14 13C15.5 14 16.5 15.5 16.5 17.5C16.5 20 14.5 22 12 22Z" 
        fill="url(#flame-inner)"
      />
      <defs>
        <linearGradient id="flame-gradient" x1="12" y1="2" x2="12" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8533"/>
          <stop offset="1" stopColor="#FF6B00"/>
        </linearGradient>
        <linearGradient id="flame-inner" x1="12" y1="13" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFAB5C"/>
          <stop offset="1" stopColor="#FF6B00"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

interface StickyHeaderProps {
  onChatOpen?: () => void
}

export function StickyHeader({ onChatOpen }: StickyHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Flame Icon */}
        <div className="flex items-center">
          <FlameIcon className="w-8 h-8" />
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Search className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Compass className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-muted-foreground hover:text-primary"
            onClick={onChatOpen}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
