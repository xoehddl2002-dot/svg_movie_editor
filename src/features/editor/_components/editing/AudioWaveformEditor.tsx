
import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { Button } from "@/components/ui/button"
import { Play, Pause, ZoomIn, ZoomOut } from "lucide-react"

interface AudioWaveformEditorProps {
    src: string
    initialStart: number // Offset in source (clip.mediaStart)
    initialDuration: number // clip.duration
    onChange: (start: number, duration: number) => void
}

export function AudioWaveformEditor({ src, initialStart, initialDuration, onChange }: AudioWaveformEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const wavesurferRef = useRef<WaveSurfer | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isReady, setIsReady] = useState(false)
    const [zoom, setZoom] = useState(10) // pixels per second
    const [duration, setDuration] = useState(0) // Total duration of source file
    const regionsRef = useRef<RegionsPlugin | null>(null)

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current) return

        setIsReady(false)

        // Create plugins instance first
        const wsRegions = RegionsPlugin.create()
        regionsRef.current = wsRegions

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#4b5563',
            progressColor: '#3b82f6',
            cursorColor: '#ef4444',
            barWidth: 2,
            barGap: 1,
            height: 128,
            minPxPerSec: zoom,
            plugins: [
                wsRegions,
                TimelinePlugin.create(),
            ],
            url: src, // Load directly via option
        })

        ws.on('ready', () => {
            setIsReady(true)
            const totalDuration = ws.getDuration()
            setDuration(totalDuration)

            // Calculate valid initial region
            // Ensure region is within bounds
            const start = Math.min(initialStart, totalDuration - 0.1)
            const end = Math.min(start + initialDuration, totalDuration)

            // Add initial region representing the clip selection
            wsRegions.addRegion({
                start: start,
                end: end,
                color: 'rgba(59, 130, 246, 0.3)',
                drag: true,
                resize: true,
                id: 'clip-region'
            })
        })

        ws.on('play', () => setIsPlaying(true))
        ws.on('pause', () => setIsPlaying(false))

        // Loop region playback logic
        // In v7, simple looping via region-out might need careful checking
        wsRegions.on('region-out', (region) => {
            if (ws.isPlaying()) {
                // Seek to start and keep playing
                // Optimization: avoid rapid loops causing issues
                region.play()
            }
        })

        // Update parent on region change
        wsRegions.on('region-updated', (region) => {
            onChange(region.start, region.end - region.start)
        })

        // Click on region to play it
        wsRegions.on('region-clicked', (region, e) => {
            e.stopPropagation()
            region.play()
        })

        wavesurferRef.current = ws

        return () => {
            try {
                // Stop playback first
                ws.pause()
                // Destroy instance
                ws.destroy()
            } catch (e) {
                console.warn("WaveSurfer cleanup error (harmless):", e)
            }
        }
    }, [src]) // Re-init on src change

    // Handle Zoom
    useEffect(() => {
        if (wavesurferRef.current && isReady) {
            wavesurferRef.current.zoom(zoom)
        }
    }, [zoom, isReady])

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause()
        }
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={togglePlay}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(1, zoom - 5))}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(100, zoom + 5))}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                    Total Duration: {duration.toFixed(2)}s
                </div>
            </div>

            <div className="border rounded-md bg-background/50 p-2 relative">
                <div ref={containerRef} className="w-full" />
            </div>

            <div className="select-none text-center">
                <p className="text-xs text-muted-foreground">
                    Drag the blue region to move the clip start. Drag the edges to resize duration.
                </p>
            </div>
        </div>
    )
}
