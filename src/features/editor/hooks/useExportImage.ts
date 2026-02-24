
import { useState } from 'react'
import { useStore } from '@/features/editor/store/useStore'
import { renderFrame } from '@/utils/render'

interface UseExportImageReturn {
    exportImage: () => Promise<void>
    isExporting: boolean
    progress: number
    status: 'idle' | 'rendering' | 'encoding' | 'completed' | 'error'
}

export const useExportImage = (): UseExportImageReturn => {
    const [isExporting, setIsExporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState<'idle' | 'rendering' | 'encoding' | 'completed' | 'error'>('idle')
    const { tracks, currentTime, aspectRatio } = useStore()

    const exportImage = async () => {
        setIsExporting(true)
        setStatus('rendering')
        setProgress(0)

        try {
            const projectWidth = 1920
            const projectHeight = 1920 / (aspectRatio || 1)

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            await renderFrame(ctx, currentTime, projectWidth, projectHeight, tracks)
            setProgress(100)
            setStatus('encoding')

            const dataUrl = canvas.toDataURL('image/png')
            const link = document.createElement('a')
            link.download = `canvas-export-${Date.now()}.png`
            link.href = dataUrl
            link.click()
            setStatus('completed')

        } catch (error) {
            console.error('Export failed:', error)
            alert('Export failed. See console.')
            setStatus('error')
        } finally {
            setIsExporting(false)
        }
    }

    return { exportImage, isExporting, progress, status }
}
