import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { useStore, type Clip } from "@/features/editor/store/useStore"
import { MaskEditor } from "./MaskEditor"
import { AudioEditor } from "./AudioEditor"

export function EditModal() {
    const { editingClipId, setEditingClipId, tracks, updateClip } = useStore()
    const [clip, setClip] = useState<Clip | null>(null)

    // Sync from store when modal opens
    useEffect(() => {
        if (editingClipId) {
            const foundClip = tracks
                .flatMap(t => t.clips)
                .find(c => c.id === editingClipId)

            if (foundClip) {
                setClip(foundClip)
            }
        } else {
            // Keep clip for exit animation if needed, but here we just clear or not
        }
    }, [editingClipId, tracks])

    const handleUpdate = (updates: Partial<Clip>) => {
        if (!clip) return
        updateClip(clip.id, updates)
    }

    const handleClose = () => {
        setEditingClipId(null)
    }

    const isOpen = !!editingClipId
    const currentClip = clip || (tracks.flatMap(t => t.clips).find(c => c.id === editingClipId) ?? null)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-[1000px] w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl">
                {!currentClip ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="loading loading-spinner">Loading...</span>
                    </div>
                ) : (
                    <>
                        {currentClip.type === 'mask' && (
                            <MaskEditor clip={currentClip} onUpdate={handleUpdate} onClose={handleClose} />
                        )}
                        {currentClip.type === 'audio' && (
                            <AudioEditor clip={currentClip} onUpdate={handleUpdate} onClose={handleClose} />
                        )}
                        {/* Fallback for other types like text */}
                        {currentClip.type === 'text' && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Text editing is not yet fully implemented in this modal.
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
