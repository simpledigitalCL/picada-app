"use client"

import { Play } from "lucide-react"

const reels = [
  { id: 1, thumbnail: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300&h=500&fit=crop", views: "125K", duration: "0:32" },
  { id: 2, thumbnail: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=500&fit=crop", views: "89K", duration: "0:45" },
  { id: 3, thumbnail: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=300&h=500&fit=crop", views: "234K", duration: "1:02" },
  { id: 4, thumbnail: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=300&h=500&fit=crop", views: "67K", duration: "0:28" },
  { id: 5, thumbnail: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=500&fit=crop", views: "456K", duration: "0:55" },
  { id: 6, thumbnail: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&h=500&fit=crop", views: "98K", duration: "0:38" },
]

export function ReelsGrid() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {reels.map((reel) => (
        <div key={reel.id} className="relative aspect-[9/16] group cursor-pointer overflow-hidden">
          <img
            src={reel.thumbnail}
            alt={`Reel ${reel.id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Play button */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </div>

          {/* Views & Duration */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-white text-xs font-medium">
              <Play className="w-3 h-3 fill-white" />
              {reel.views}
            </div>
            <span className="text-white text-xs font-medium bg-black/40 px-1.5 py-0.5 rounded">
              {reel.duration}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
