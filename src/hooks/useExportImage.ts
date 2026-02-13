
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { renderFrame } from '@/utils/render'

interface UseExportImageReturn {
    exportImage: () => Promise<void>
    isExporting: boolean
}

export const useExportImage = (): UseExportImageReturn => {
    const [isExporting, setIsExporting] = useState(false)
    const { tracks, currentTime, aspectRatio } = useStore()

    const exportImage = async () => {
        setIsExporting(true)

        try {
            const projectWidth = 1920
            const projectHeight = 1920 / (aspectRatio || 1)

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            await renderFrame(ctx, currentTime, projectWidth, projectHeight, tracks)

            const dataUrl = canvas.toDataURL('image/png')
            const link = document.createElement('a')
            link.download = `canvas-export-${Date.now()}.png`
            link.href = dataUrl
            link.click()

        } catch (error) {
            console.error('Export failed:', error)
            alert('Export failed. See console.')
        } finally {
            setIsExporting(false)
        }
    }

    return { exportImage, isExporting }
}
