"use client"

import { MapPin, Clock, Percent } from "lucide-react"

const picadas = [
  {
    id: 1,
    name: "Chori Buenos Aires",
    type: "Street Food",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=300&h=200&fit=crop",
    matchScore: 98,
    distance: "1.2 km",
    openNow: true,
    tags: ["Choripán", "Económico", "Rápido"]
  },
  {
    id: 2,
    name: "Florería Atlántico",
    type: "Speakeasy Bar",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=300&h=200&fit=crop",
    matchScore: 94,
    distance: "2.8 km",
    openNow: true,
    tags: ["Cócteles", "Secreto", "Premium"]
  },
  {
    id: 3,
    name: "El Cuartito",
    type: "Pizzería Clásica",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop",
    matchScore: 91,
    distance: "3.5 km",
    openNow: false,
    tags: ["Pizza", "Tradicional", "Histórico"]
  },
  {
    id: 4,
    name: "Don Julio",
    type: "Parrilla Premium",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?w=300&h=200&fit=crop",
    matchScore: 87,
    distance: "4.1 km",
    openNow: true,
    tags: ["Carne", "Vino", "Especial"]
  },
]

export function PicadasList() {
  return (
    <div className="p-4 space-y-4">
      {picadas.map((picada) => (
        <div
          key={picada.id}
          className="bg-secondary/50 rounded-3xl overflow-hidden hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          <div className="relative">
            <img
              src={picada.image}
              alt={picada.name}
              className="w-full h-36 object-cover"
            />
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">{picada.matchScore}%</span>
              <span className="text-xs text-muted-foreground">Match</span>
            </div>
            <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${
              picada.openNow ? 'bg-emerald-500/90 text-white' : 'bg-muted/90 text-foreground'
            }`}>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {picada.openNow ? 'Abierto' : 'Cerrado'}
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-balance">{picada.name}</h3>
                <p className="text-xs text-muted-foreground">{picada.type}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <MapPin className="w-3 h-3" />
                {picada.distance}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              {picada.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-foreground/70 bg-background px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
