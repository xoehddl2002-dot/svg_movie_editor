import { useStore, type Clip as ClipType } from "@/features/editor/store/useStore"
import { Music, Type, Shapes, LayoutTemplate, Smile } from "lucide-react"

interface ClipProps {
    clip: ClipType
    zoom: number
    trackHeight: number
    isSelected?: boolean
    onDragStart?: (e: React.MouseEvent, clipId: string) => void
    onResizeStart?: (e: React.MouseEvent, clipId: string, direction: 'start' | 'end') => void
}

export function Clip({ clip, zoom, trackHeight, isSelected, onDragStart, onResizeStart }: ClipProps) {
    const { setEditingClipId } = useStore()
    const width = clip.duration * zoom
    const x = clip.start * zoom

    const getClipColor = (clip: ClipType) => {
        // if (clip.templateData) return '#0d9488' // Teal for Templates - Removed to allow resource specific colors

        switch (clip.type) {
            case 'audio': return '#22c55e' // Green
            case 'text': return '#06b6d4' // Cyan
            case 'shape': return '#f97316' // Orange for Basic Shapes
            case 'icon': return '#14b8a6' // Teal for Icons
            case 'mask': return '#ec4899' // Pink for Mask
            default: return '#6b7280' // Gray
        }
    }

    const getIcon = (clip: ClipType) => {
        const props = { className: "h-3 w-3 text-white/90 mr-1" }
        // if (clip.templateData) return <LayoutTemplate {...props} />

        switch (clip.type) {
            case 'audio': return <Music {...props} />
            case 'text': return <Type {...props} />
            case 'shape': return <Shapes {...props} />
            case 'icon': return <Smile {...props} />
            case 'mask': return <LayoutTemplate {...props} />
            default: return <LayoutTemplate {...props} />
        }
    }

    return (
        <g
            transform={`translate(${x}, 5)`}
            className={`cursor-grab active:cursor-grabbing group`}
            onMouseDown={(e) => onDragStart?.(e, clip.id)}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (clip.type === 'mask' || clip.type === 'audio') {
                    setEditingClipId(clip.id);
                }
            }}
        >
            <rect
                width={width}
                height={trackHeight - 10}
                rx={4}
                fill={getClipColor(clip)}
                stroke={isSelected ? "white" : "transparent"}
                strokeWidth={isSelected ? 2 : 2}
                strokeDasharray={clip.type === 'audio' ? "4 2" : "0"}
                className={isSelected ? "" : "group-hover:stroke-white/50 transition-colors"}
                opacity={clip.type === 'audio' ? 0.6 : 0.8}
            />
            {/* Clip Content Overlay */}
            <foreignObject x={0} y={0} width={width} height={trackHeight - 10} style={{ pointerEvents: 'none' }}>
                <div className="w-full h-full flex items-center px-2 overflow-hidden text-xs text-white/90 font-medium select-none">
                    {getIcon(clip)}
                    <span className="truncate drop-shadow-md">{clip.name}</span>
                </div>
            </foreignObject>


            {/* Trim Handles - Only for non-video/audio clips */}
            {clip.type !== 'audio' && (
                <>
                    {/* Left Handle (Start) */}
                    <rect
                        x={0} y={0} width={6} height={trackHeight - 10}
                        fill="transparent"
                        className="cursor-w-resize z-10 hover:bg-white/20"
                        onMouseDown={(e) => onResizeStart?.(e, clip.id, 'start')}
                    />
                    {/* Right Handle (End) */}
                    <rect
                        x={width - 6} y={0} width={6} height={trackHeight - 10}
                        fill="transparent"
                        className="cursor-e-resize z-10 hover:bg-white/20"
                        onMouseDown={(e) => onResizeStart?.(e, clip.id, 'end')}
                    />
                </>
            )}
        </g>
    )
}
