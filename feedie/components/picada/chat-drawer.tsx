"use client"

import { X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import Image from "next/image"

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const mockChats = [
  {
    id: 1,
    name: "María García",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    lastMessage: "Ese restaurante es increíble!",
    time: "2m",
    unread: 2,
  },
  {
    id: 2,
    name: "Carlos Ruiz",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    lastMessage: "Probemos la nueva taquería",
    time: "15m",
    unread: 0,
  },
  {
    id: 3,
    name: "Ana López",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    lastMessage: "Te envié la ubicación",
    time: "1h",
    unread: 1,
  },
  {
    id: 4,
    name: "Diego Morales",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    lastMessage: "Gracias por la recomendación!",
    time: "3h",
    unread: 0,
  },
]

export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const [selectedChat, setSelectedChat] = useState<number | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Mensajes</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {mockChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors border-b border-border/50"
            >
              <div className="relative">
                <Image
                  src={chat.avatar}
                  alt={chat.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
                {chat.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                    {chat.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{chat.name}</span>
                  <span className="text-xs text-muted-foreground">{chat.time}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Message Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
            <input
              type="text"
              placeholder="Enviar mensaje..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <Button size="icon" className="h-8 w-8 rounded-full bg-primary text-white">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
