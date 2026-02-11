import React from "react"

interface PlayheadProps {
    currentTime: number
    zoom: number
    height: number
    onDragStart: (e: React.MouseEvent) => void
}

export function Playhead({ currentTime, zoom, height, onDragStart }: PlayheadProps) {
    const x = currentTime * zoom

    return (
        <g transform={`translate(${x}, 0)`} className="cursor-ew-resize" onMouseDown={onDragStart} style={{ zIndex: 10 }}>
            <line x1={0} y1={0} x2={0} y2={height} stroke="hsl(var(--destructive))" strokeWidth={1.5} />
            <polygon points="-5,0 5,0 0,10" fill="hsl(var(--destructive))" />
        </g>
    )
}
