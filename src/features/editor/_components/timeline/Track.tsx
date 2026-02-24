import React from "react"
import { Clip } from "./Clip"
import type { Clip as ClipType } from "@/features/editor/store/useStore"

interface TrackProps {
    id: string
    type: string
    index: number
    clips: ClipType[]
    zoom: number
    height?: number
    selectedClipId?: string | null
    onClipDragStart?: (e: React.MouseEvent, clipId: string) => void
    onClipResizeStart?: (e: React.MouseEvent, clipId: string, direction: 'start' | 'end') => void
}

export function Track({ id, type, index, clips, zoom, height = 50, selectedClipId, onClipDragStart, onClipResizeStart }: TrackProps) {
    const y = index * height

    return (
        <g transform={`translate(0, ${y})`}>
            <rect x="0" y="0" width="100%" height={height} fill={index % 2 === 0 ? "hsl(var(--muted)/0.1)" : "transparent"} />

            {/* Track Info (Overlay) */}
            <text
                x={10}
                y={15}
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
                fontWeight="500"
                className="pointer-events-none uppercase opacity-50"
            >
                Track {index + 1}
            </text>

            <line x1="0" y1={height} x2="100%" y2={height} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="2 2" />

            {clips.map((clip) => (
                <Clip
                    key={clip.id}
                    clip={clip}
                    zoom={zoom}
                    trackHeight={height}
                    isSelected={clip.id === selectedClipId}
                    onDragStart={onClipDragStart}
                    onResizeStart={onClipResizeStart}
                />
            ))}
        </g>
    )
}
