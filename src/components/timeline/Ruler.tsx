import React, { useMemo } from "react"

interface RulerProps {
    activeDuration: number // highlighted part
    totalDuration: number // total ticks to show
    zoom: number // pixels per second
    height?: number
}

export function Ruler({ activeDuration, totalDuration, zoom, height = 30 }: RulerProps) {
    const ticks = useMemo(() => {
        const tickInterval = 1 // 1 second for now, can be dynamic
        const count = Math.ceil(totalDuration / tickInterval)
        return Array.from({ length: count + 1 }, (_, i) => i * tickInterval)
    }, [totalDuration])

    return (
        <g className="ruler">
            <defs>
                <pattern id="ruler-ticks" x="0" y="0" width={100} height={height} patternUnits="userSpaceOnUse">
                    {/* Optimized pattern if needed */}
                </pattern>
            </defs>
            {/* Background for total duration */}
            <rect x="0" y="0" width={totalDuration * zoom} height={height} fill="hsl(var(--muted)/0.3)" />
            {/* Highlight for active duration */}
            <rect x="0" y="0" width={activeDuration * zoom} height={height} fill="hsl(var(--primary)/0.1)" />
            {ticks.map((time) => {
                const x = time * zoom
                const isMajor = time % 10 === 0
                const isMedium = time % 5 === 0
                return (
                    <React.Fragment key={time}>
                        <line
                            x1={x}
                            y1={height}
                            x2={x}
                            y2={height - (isMajor ? 14 : isMedium ? 10 : 6)}
                            stroke="hsl(var(--foreground)/0.6)"
                            strokeWidth={isMajor ? 1.5 : 1}
                        />
                        {isMajor && (
                            <text
                                x={x + 2}
                                y={height - 18}
                                fontSize={10}
                                fontWeight="600"
                                fill="hsl(var(--foreground)/0.8)"
                                pointerEvents="none"
                            >
                                {new Date(time * 1000).toISOString().substr(14, 5)}
                            </text>
                        )}
                    </React.Fragment>
                )
            })}
        </g>
    )
}
