"use client"

import { Heart, MessageCircle, Bookmark, Share, MapPin, MoreHorizontal, Flame, Percent, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface PostCardProps {
  compact?: boolean
}

export function PostCard({ compact = false }: PostCardProps) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likes, setLikes] = useState(2847)

  const handleLike = () => {
    setLiked(!liked)
    setLikes(liked ? likes - 1 : likes + 1)
  }

  return (
    <div className={`bg-card ${compact ? '' : 'border-b border-border'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-primary to-orange-400">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop"
              alt="User"
              className="w-full h-full rounded-full object-cover border-2 border-background"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">laura_gourmet</span>
              <span className="text-xs text-primary">Pro</span>
            </div>
            <span className="text-xs text-muted-foreground">Buenos Aires, Argentina</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-full h-8 px-3 text-xs font-medium">
            <UserPlus className="w-3 h-3 mr-1" />
            Seguir
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image with Stickers */}
      <div className="relative aspect-square">
        <img
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=800&fit=crop"
          alt="Food post"
          className="w-full h-full object-cover"
        />
        
        {/* Draggable-style stickers */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-foreground">320</span>
            <span className="text-xs text-muted-foreground">Kcal</span>
          </div>
          <div className="bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <Percent className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">94%</span>
            <span className="text-xs text-white/80">Match</span>
          </div>
        </div>
      </div>

      {/* Social Bar */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="flex items-center gap-1 group">
              <Heart className={`w-6 h-6 transition-all ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-foreground group-hover:text-red-500'}`} />
            </button>
            <button className="flex items-center gap-1 group">
              <MessageCircle className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
            </button>
            <button className="flex items-center gap-1 group">
              <Share className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
          <button 
            onClick={() => setSaved(!saved)}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors"
          >
            <Bookmark className={`w-5 h-5 ${saved ? 'fill-primary text-primary' : 'text-primary'}`} />
            <span className="text-sm font-medium text-primary">Guardar Ruta</span>
          </button>
        </div>

        {/* Likes */}
        <p className="mt-3 text-sm font-semibold text-foreground">{likes.toLocaleString()} me gusta</p>

        {/* Caption */}
        <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
          <span className="font-semibold text-foreground">laura_gourmet</span>{' '}
          Esta ensalada de quinoa con aguacate es simplemente perfecta para un almuerzo saludable. La combinación de texturas y sabores es increíble 🥗✨
        </p>

        {/* Location Tag */}
        <button className="mt-3 flex items-center gap-2 bg-secondary hover:bg-secondary/80 px-3 py-2 rounded-full transition-colors">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Café Martínez - Palermo</span>
        </button>

        {/* Comments Preview */}
        <p className="mt-3 text-sm text-muted-foreground">Ver los 89 comentarios</p>
        <p className="mt-1 text-xs text-muted-foreground">Hace 2 horas</p>
      </div>
    </div>
  )
}
