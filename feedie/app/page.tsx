"use client"

import { useState } from "react"
import { StickyHeader } from "@/components/picada/sticky-header"
import { StoriesHeader } from "@/components/picada/stories-header"
import { ProfileSection } from "@/components/picada/profile-section"
import { BadgesShowcase } from "@/components/picada/badges-showcase"
import { NavigationTabs } from "@/components/picada/navigation-tabs"
import { PostCard } from "@/components/picada/post-card"
import { FloatingActionButton } from "@/components/picada/floating-action-button"
import { BottomNavigation } from "@/components/picada/bottom-navigation"
import { ChatDrawer } from "@/components/picada/chat-drawer"

export default function PicadaApp() {
  const [currentView, setCurrentView] = useState<"profile" | "home">("profile")
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <main className="min-h-screen bg-background max-w-lg mx-auto relative">
      <StickyHeader onChatOpen={() => setIsChatOpen(true)} />
      
      {currentView === "profile" ? (
        <>
          <StoriesHeader />
          <ProfileSection />
          <BadgesShowcase />
          <NavigationTabs />
        </>
      ) : (
        <div className="pb-24">
          <StoriesHeader />
          <PostCard />
          <PostCard />
        </div>
      )}
      
      <FloatingActionButton />
      <BottomNavigation 
        activeTab={currentView} 
        onTabChange={(tab) => setCurrentView(tab === "home" ? "home" : "profile")} 
      />
      
      {/* Bottom padding for navigation */}
      <div className="h-24" />
      
      {/* Chat Drawer */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </main>
  )
}
