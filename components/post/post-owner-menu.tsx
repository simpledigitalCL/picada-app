'use client'

import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { deletePost, isLocalPostId } from '@/lib/api/posts'
import { removeLocalSocialPost } from '@/lib/feed/personalization'
import { cn } from '@/lib/utils'

type Props = {
  postId: string
  isOwn: boolean
  /** Abre el editor del post (lo controla el padre, que tiene los datos). */
  onEdit: () => void
  /** Se llama tras un borrado exitoso, con el id borrado. */
  onDeleted?: (id: string) => void
  className?: string
}

/**
 * Menú ⋯ de acciones del autor sobre su propio post (Editar / Eliminar).
 * Patrón Instagram/Google Maps: overflow → bottom sheet; borrar pide confirmación.
 * Solo se renderiza si `isOwn`. El backend igual valida propiedad (403).
 */
export function PostOwnerMenu({ postId, isOwn, onEdit, onDeleted, className }: Props) {
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!isOwn) return null

  const handleDelete = async () => {
    setDeleting(true)
    try {
      // Los posts locales (`local-…`) aún no existen en el servidor.
      if (!isLocalPostId(postId)) await deletePost(postId)
      removeLocalSocialPost(postId)
      window.dispatchEvent(new CustomEvent('picada:post-deleted', { detail: { id: postId } }))
      toast({ title: 'Publicación eliminada' })
      setConfirmOpen(false)
      setMenuOpen(false)
      onDeleted?.(postId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'delete_failed'
      toast({
        title: 'No se pudo eliminar',
        description: message === 'forbidden' ? 'No eres el autor de esta publicación.' : 'Reintenta más tarde.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Más acciones"
        onClick={e => { e.stopPropagation(); setMenuOpen(true) }}
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 active:bg-muted',
          className,
        )}
      >
        <MoreVertical className="size-5" />
      </button>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetTitle className="sr-only">Acciones de la publicación</SheetTitle>
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3" />
          <div className="p-3 pb-6">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onEdit() }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/40 active:bg-muted/60"
            >
              <Pencil className="size-5 shrink-0" />
              Editar publicación
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setConfirmOpen(true) }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100"
            >
              <Trash2 className="size-5 shrink-0" />
              Eliminar
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={o => !deleting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se quitará de tu perfil y del feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); void handleDelete() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
