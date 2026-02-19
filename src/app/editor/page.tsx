'use client'

import { Header } from "@/features/editor/_components/layout/Header"
import { Sidebar } from "@/features/editor/_components/layout/Sidebar"
import { PreviewPlayer } from "@/features/editor/_components/preview/PreviewPlayer"
import { Timeline } from "@/features/editor/_components/timeline/Timeline"
import { EditModal } from "@/features/editor/_components/editing/EditModal"
import { useEffect } from "react"
import { useStore } from "@/features/editor/store/useStore"
import { useRouter } from "next/navigation"

export default function EditorPage() {
    const router = useRouter()
    const { tracks, setSelectedClipId, timelineHeight, setTimelineHeight } = useStore()

    // Redirect to home if no project is loaded
    useEffect(() => {
        const hasClips = tracks.some(track => track.clips.length > 0)
        if (!hasClips) {
            router.push('/')
        }
    }, [tracks, router])

    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('.prevent-deselect') && !target.closest('.resize-handle')) {
                setSelectedClipId(null)
            }
        }

        window.addEventListener('mousedown', handleGlobalClick)
        return () => window.removeEventListener('mousedown', handleGlobalClick)
    }, [setSelectedClipId])

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault()
        const startY = e.clientY
        const startHeight = timelineHeight

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = startY - moveEvent.clientY
            const newHeight = Math.max(150, Math.min(window.innerHeight - 200, startHeight + deltaY))
            setTimelineHeight(newHeight)
        }

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    return (
        <>
            <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
                <Header />
                <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <PreviewPlayer />

                        <div
                            className="h-1 bg-border hover:bg-primary cursor-ns-resize transition-colors resize-handle prevent-deselect shrink-0"
                            onMouseDown={handleResizeStart}
                        />

                        <Timeline />
                    </div>
                </div>
            </div>
            <EditModal />
        </>
    )
}
