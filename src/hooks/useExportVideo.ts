
import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { renderFrame, prefetchVideoFrames } from '@/utils/render'

interface UseExportVideoReturn {
    exportVideo: (fps: number) => Promise<void>
    cancelExport: () => void
    isExporting: boolean
}

export const useExportVideo = (): UseExportVideoReturn => {
    const [isExporting, setIsExporting] = useState(false)
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const { tracks, aspectRatio, duration } = useStore()

    // Prevent closing/refreshing while exporting
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isExporting) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isExporting])

    const cancelExport = () => {
        if (abortController) {
            abortController.abort()
        }
        setIsExporting(false)
        setAbortController(null)
    }

    const exportVideo = async (fps: number) => {
        const controller = new AbortController()
        setAbortController(controller)
        const signal = controller.signal

        setIsExporting(true)

        try {
            const projectWidth = 1920
            const projectHeight = 1920 / (aspectRatio || 1)

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            const totalFrames = Math.max(1, Math.ceil(duration * fps))

            // 1. Prefetch Video Frames
            if (signal.aborted) throw new Error('Export cancelled')
            // Note: tracks passed to prefetch
            const videoFrameMap = await prefetchVideoFrames(fps, duration, tracks)
            if (signal.aborted) throw new Error('Export cancelled')

            // 2. Render and collect frames
            const frames: string[] = []
            for (let i = 0; i < totalFrames; i++) {
                if (signal.aborted) throw new Error('Export cancelled')

                const time = i / fps
                await renderFrame(ctx, time, projectWidth, projectHeight, tracks, i, videoFrameMap)

                const base64 = canvas.toDataURL('image/png')
                frames.push(base64)
            }

            if (signal.aborted) throw new Error('Export cancelled')

            // 3. Send to API
            const formData = new FormData()
            formData.append('fps', fps.toString())
            formData.append('frameCount', frames.length.toString())
            frames.forEach((frame, idx) => {
                formData.append(`frame-${idx}`, frame)
            })

            // Collect audio tracks
            const audioClips = tracks
                .filter(t => t.type === 'audio')
                .flatMap(t => t.clips)
                .map(clip => ({
                    src: clip.src,
                    start: clip.start,
                    duration: clip.duration,
                    mediaStart: clip.mediaStart || 0,
                    volume: clip.volume ?? 1
                }));

            if (audioClips.length > 0) {
                formData.append('audioTracks', JSON.stringify(audioClips));
            }

            const response = await fetch('/api/render-video', {
                method: 'POST',
                body: formData,
                signal
            })

            if (!response.ok) {
                const text = await response.text()
                let errorMsg = 'Failed to render video'
                try {
                    const json = JSON.parse(text)
                    errorMsg = json.error || errorMsg
                } catch {
                    errorMsg = text || errorMsg
                }
                throw new Error(errorMsg)
            }

            // 4. Download result
            const videoBlob = await response.blob()
            const url = URL.createObjectURL(videoBlob)
            const link = document.createElement('a')
            link.download = `project-${Date.now()}.mp4`
            link.href = url
            link.click()

            console.log('MP4 export successful')

        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Export cancelled') {
                console.log('Video export cancelled by user')
            } else {
                console.error('Video export failed details:', error)
                const msg = error.message || (typeof error === 'string' ? error : 'Check network tab for details')
                alert(`Failed to export Video: ${msg}`)
            }
        } finally {
            setIsExporting(false)
            setAbortController(null)
        }
    }

    return { exportVideo, cancelExport, isExporting }
}
