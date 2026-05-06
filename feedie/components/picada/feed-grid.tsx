"use client"

import { Heart, MessageCircle } from "lucide-react"

const feedItems = [
  { id: 1, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop", likes: "2.4K", comments: 89 },
  { id: 2, image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=400&fit=crop", likes: "1.8K", comments: 45 },
  { id: 3, image: "https://images.unsplash.com/photo-1482049016gy-ed8f9a76ae0b?w=400&h=400&fit=crop", likes: "3.1K", comments: 112 },
  { id: 4, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", likes: "956", comments: 28 },
  { id: 5, image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop", likes: "4.2K", comments: 203 },
  { id: 6, image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop", likes: "1.2K", comments: 67 },
  { id: 7, image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=400&fit=crop", likes: "2.9K", comments: 94 },
  { id: 8, image: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=400&fit=crop", likes: "1.5K", comments: 51 },
  { id: 9, image: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=400&fit=crop", likes: "876", comments: 23 },
]

export function FeedGrid() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {feedItems.map((item) => (
        <div key={item.id} className="relative aspect-square group cursor-pointer overflow-hidden">
          <img
            src={item.image}
            alt={`Food post ${item.id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
            <div className="flex items-center gap-1 text-white">
              <Heart className="w-5 h-5 fill-white" />
              <span className="text-sm font-semibold">{item.likes}</span>
            </div>
            <div className="flex items-center gap-1 text-white">
              <MessageCircle className="w-5 h-5 fill-white" />
              <span className="text-sm font-semibold">{item.comments}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
