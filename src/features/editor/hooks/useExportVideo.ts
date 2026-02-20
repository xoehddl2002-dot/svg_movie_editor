
import { useState, useEffect } from 'react'
import { useStore } from '@/features/editor/store/useStore'
import { renderFrame, prefetchVideoFrames } from '@/utils/render'

interface UseExportVideoReturn {
    exportVideo: (fps: number) => Promise<void>
    cancelExport: () => void
    isExporting: boolean
    progress: number
    status: 'idle' | 'rendering' | 'encoding' | 'completed' | 'error'
}

export const useExportVideo = (): UseExportVideoReturn => {
    const [isExporting, setIsExporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState<'idle' | 'rendering' | 'encoding' | 'completed' | 'error'>('idle')
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
        console.log(`[Export Debug] exportVideo called with FPS: ${fps}`)
        console.log(`[Export Debug] Current Store Duration: ${duration}`)
        
        const controller = new AbortController()
        setAbortController(controller)
        const signal = controller.signal

        setIsExporting(true)
        setStatus('rendering')
        setProgress(0)

        try {
            const projectWidth = 1920
            // libx264 with yuv420p requires even dimensions; round to nearest even integer
            const projectHeight = Math.round(1920 / (aspectRatio || 1) / 2) * 2

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            const totalFrames = Math.max(1, Math.ceil(duration * fps))
            console.log(`[Export Debug] Calculated totalFrames: ${totalFrames} (Duration: ${duration} * FPS: ${fps})`)

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
                
                // Update progress - Max 99% during rendering
                setProgress(Math.round(((i + 1) / totalFrames) * 99))
            }

            if (signal.aborted) throw new Error('Export cancelled')

            // 3. Send to API
            setStatus('encoding')
            // Allow UI to update to "Encoding... 99%" before standard sync freeze of FormData
            await new Promise(resolve => setTimeout(resolve, 100))

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

            setProgress(100)

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
            setStatus('completed')

        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Export cancelled') {
                console.log('Video export cancelled by user')
            } else {
                console.error('Video export failed details:', error)
                const msg = error.message || (typeof error === 'string' ? error : 'Check network tab for details')
                alert(`Failed to export Video: ${msg}`)
            }
            setStatus('error')
        } finally {
            setIsExporting(false)
            setAbortController(null)
        }
    }

    return { exportVideo, cancelExport, isExporting, progress, status }
}
