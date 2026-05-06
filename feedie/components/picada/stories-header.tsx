"use client"

import { Plus, Radio } from "lucide-react"

const stories = [
  { id: 1, name: "Ana", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop", isLive: true },
  { id: 2, name: "Carlos", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", isLive: false },
  { id: 3, name: "María", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", isLive: true },
  { id: 4, name: "Diego", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", isLive: false },
  { id: 5, name: "Laura", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop", isLive: false },
  { id: 6, name: "Pablo", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop", isLive: true },
]

export function StoriesHeader() {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Tu Historia</span>
        </div>

        {/* Stories */}
        {stories.map((story) => (
          <div key={story.id} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="relative">
              <div className={`w-16 h-16 rounded-full p-[2px] ${story.isLive ? 'bg-gradient-to-br from-primary via-orange-400 to-yellow-500 animate-pulse' : 'bg-gradient-to-br from-primary to-orange-400'}`}>
                <img
                  src={story.avatar}
                  alt={story.name}
                  className="w-full h-full rounded-full object-cover border-2 border-background"
                />
              </div>
              {story.isLive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Radio className="w-2 h-2" />
                  LIVE
                </div>
              )}
            </div>
            <span className="text-xs text-foreground/80">{story.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
