"use client"

import { useState } from "react"
import { Grid3X3, Play, Star, Bookmark } from "lucide-react"
import { FeedGrid } from "./feed-grid"
import { ReelsGrid } from "./reels-grid"
import { ReviewsList } from "./reviews-list"
import { PicadasList } from "./picadas-list"

const tabs = [
  { id: "feed", icon: Grid3X3, label: "Feed" },
  { id: "reels", icon: Play, label: "Reels" },
  { id: "reviews", icon: Star, label: "Reseñas" },
  { id: "picadas", icon: Bookmark, label: "Picadas" },
]

export function NavigationTabs() {
  const [activeTab, setActiveTab] = useState("feed")

  return (
    <div>
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 relative transition-colors ${
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "feed" && <FeedGrid />}
        {activeTab === "reels" && <ReelsGrid />}
        {activeTab === "reviews" && <ReviewsList />}
        {activeTab === "picadas" && <PicadasList />}
      </div>
    </div>
  )
}
