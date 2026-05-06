"use client"

import { Star, MapPin, ThumbsUp } from "lucide-react"

const reviews = [
  {
    id: 1,
    restaurant: "La Cabrera",
    cuisine: "Parrilla Argentina",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&h=100&fit=crop",
    snippet: "Una experiencia carnívora incomparable. El bife de chorizo literalmente se derrite en la boca...",
    date: "Hace 2 días",
    likes: 234,
    location: "Palermo, CABA"
  },
  {
    id: 2,
    restaurant: "Sushi Pop",
    cuisine: "Nikkei Fusión",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=100&h=100&fit=crop",
    snippet: "Creatividad en cada bocado. El roll de salmón ahumado con mango es una explosión de sabores...",
    date: "Hace 1 semana",
    likes: 189,
    location: "Recoleta, CABA"
  },
  {
    id: 3,
    restaurant: "El Preferido",
    cuisine: "Bodegón Clásico",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=100&fit=crop",
    snippet: "Auténtica cocina de abuela. Las empanadas son las mejores que probé en mi vida...",
    date: "Hace 2 semanas",
    likes: 412,
    location: "San Telmo, CABA"
  },
  {
    id: 4,
    restaurant: "Café Tortoni",
    cuisine: "Café Histórico",
    rating: 4.2,
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop",
    snippet: "Un clásico porteño. El ambiente es increíble y el café con churros perfecto para una tarde...",
    date: "Hace 3 semanas",
    likes: 156,
    location: "Monserrat, CABA"
  },
]

export function ReviewsList() {
  return (
    <div className="p-4 space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="bg-secondary/50 rounded-3xl p-4 hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          <div className="flex gap-4">
            <img
              src={review.image}
              alt={review.restaurant}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-balance">{review.restaurant}</h3>
                  <p className="text-xs text-muted-foreground">{review.cuisine}</p>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full flex-shrink-0">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-sm font-semibold text-primary">{review.rating}</span>
                </div>
              </div>
              
              <p className="text-sm text-foreground/70 mt-2 line-clamp-2 leading-relaxed">{review.snippet}</p>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {review.location}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="w-3 h-3" />
                    {review.likes}
                  </div>
                  <span className="text-xs text-muted-foreground">{review.date}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
