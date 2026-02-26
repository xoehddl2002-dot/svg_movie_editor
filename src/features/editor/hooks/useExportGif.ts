
import { useState, useEffect } from 'react'
import { useStore } from '@/features/editor/store/useStore'
import { renderFrame, prefetchVideoFrames } from '@/utils/render'

interface UseExportGifReturn {
    exportGif: (fps: number) => Promise<void>
    cancelExport: () => void
    isExporting: boolean
    progress: number
    status: 'idle' | 'rendering' | 'encoding' | 'completed' | 'error'
}

export const useExportGif = (): UseExportGifReturn => {
    const [isExporting, setIsExporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState<'idle' | 'rendering' | 'encoding' | 'completed' | 'error'>('idle')
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const { tracks, duration, projectWidth, projectHeight } = useStore()

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

    const exportGif = async (fps: number) => {
        console.log(`[GIF Export] exportGif called with FPS: ${fps}`)
        console.log(`[GIF Export] Duration: ${duration}, Size: ${projectWidth}x${projectHeight}`)

        const controller = new AbortController()
        setAbortController(controller)
        const signal = controller.signal

        setIsExporting(true)
        setStatus('rendering')
        setProgress(0)

        try {
            // GIF 파일 크기 관리를 위해 비율 유지하면서 축소
            const maxDim = 640
            const scale = Math.min(1, maxDim / Math.max(projectWidth, projectHeight))
            const exportWidth = Math.round(projectWidth * scale)
            const exportHeight = Math.round(projectHeight * scale)

            // 원본 크기로 렌더링할 캔버스
            const renderCanvas = document.createElement('canvas')
            renderCanvas.width = projectWidth
            renderCanvas.height = projectHeight
            const renderCtx = renderCanvas.getContext('2d')
            if (!renderCtx) throw new Error('Could not get render 2d context')

            // 축소된 크기로 출력할 캔버스
            const exportCanvas = document.createElement('canvas')
            exportCanvas.width = exportWidth
            exportCanvas.height = exportHeight
            const exportCtx = exportCanvas.getContext('2d')
            if (!exportCtx) throw new Error('Could not get export 2d context')

            const totalFrames = Math.max(1, Math.ceil(duration * fps))
            console.log(`[GIF Export] Frames: ${totalFrames} (${projectWidth}x${projectHeight} → ${exportWidth}x${exportHeight})`)

            // 1. Prefetch Video Frames
            if (signal.aborted) throw new Error('Export cancelled')
            const videoFrameMap = await prefetchVideoFrames(fps, duration, tracks)
            if (signal.aborted) throw new Error('Export cancelled')

            // 2. Render and collect frames
            const frames: string[] = []
            for (let i = 0; i < totalFrames; i++) {
                if (signal.aborted) throw new Error('Export cancelled')

                const time = i / fps
                // 원본 해상도로 렌더링
                await renderFrame(renderCtx, time, projectWidth, projectHeight, tracks, i, videoFrameMap)

                // 비율 유지하면서 축소 복사
                exportCtx.clearRect(0, 0, exportWidth, exportHeight)
                exportCtx.drawImage(renderCanvas, 0, 0, exportWidth, exportHeight)

                const base64 = exportCanvas.toDataURL('image/png')
                frames.push(base64)

                // Progress: 0-90% for rendering
                setProgress(Math.round(((i + 1) / totalFrames) * 90))
            }

            if (signal.aborted) throw new Error('Export cancelled')

            // 3. Send to FFmpeg API
            setStatus('encoding')
            await new Promise(resolve => setTimeout(resolve, 100))

            const formData = new FormData()
            formData.append('fps', fps.toString())
            formData.append('frameCount', frames.length.toString())
            frames.forEach((frame, idx) => {
                formData.append(`frame-${idx}`, frame)
            })

            setProgress(95)

            const response = await fetch('/api/render-gif', {
                method: 'POST',
                body: formData,
                signal
            })

            if (!response.ok) {
                const text = await response.text()
                let errorMsg = 'Failed to render GIF'
                try {
                    const json = JSON.parse(text)
                    errorMsg = json.error || errorMsg
                } catch {
                    errorMsg = text || errorMsg
                }
                throw new Error(errorMsg)
            }

            // 4. Download result
            const rawBlob = await response.blob()
            const gifBlob = new Blob([rawBlob], { type: 'image/gif' })
            const url = URL.createObjectURL(gifBlob)
            const link = document.createElement('a')
            link.download = `project-${Date.now()}.gif`
            link.href = url
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            console.log(`GIF export successful (${(gifBlob.size / 1024 / 1024).toFixed(1)} MB)`)
            setProgress(100)
            setStatus('completed')

        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Export cancelled') {
                console.log('GIF export cancelled by user')
            } else {
                console.error('GIF export failed:', error)
                const msg = error.message || 'Check console for details'
                alert(`Failed to export GIF: ${msg}`)
            }
            setStatus('error')
        } finally {
            setIsExporting(false)
            setAbortController(null)
        }
    }

    return { exportGif, cancelExport, isExporting, progress, status }
}
