import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Search } from "lucide-react"
import { useStore, type Clip } from "@/store/useStore"
import React, { useEffect, useRef, useState } from "react"
import { DynamicSvg } from "./DynamicSvg"
import { TransformControls } from "./TransformControls"
import { getTextDimensions } from "@/utils/textUtils"

const getMediaStyle = (clip: Clip): React.CSSProperties => {
    const flipH = clip.flipH || false
    const flipV = clip.flipV || false
    const rotation = clip.rotation || 0

    const crop = clip.crop
    let transformOrigin = 'center center'
    if (crop) {
        transformOrigin = `${crop.x + crop.width / 2}% ${crop.y + crop.height / 2}%`
    }

    return {
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
        transformOrigin: 'center center'
    }
}

const getCropStyle = (clip: Clip): React.CSSProperties => {
    const crop = clip.crop
    if (!crop) {
        return {
            width: '100%',
            height: '100%'
        }
    }

    // crop.x, y, width, height are in percentages
    // We want to scale the view so that the crop area fills the container (100% x 100%)
    // Scale factor = 100 / crop.width
    // Translation = -crop.x, -crop.y
    // Order: Translate then Scale (in CSS transform syntax: scale() translate())

    const scaleX = 100 / crop.width
    const scaleY = 100 / crop.height

    return {
        width: '100%',
        height: '100%',
        transformOrigin: '0 0',
        transform: `scale(${scaleX}, ${scaleY}) translate(-${crop.x}%, -${crop.y}%)`
    }
}

function VideoClip({ clip, currentTime, isPlaying }: { clip: Clip, currentTime: number, isPlaying: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const relativeTime = currentTime - clip.start
    const mediaTime = relativeTime + (clip.mediaStart || 0)

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        if (isPlaying && (relativeTime >= 0 && relativeTime <= clip.duration)) {
            video.play().catch(() => { })
        } else {
            video.pause()
        }
    }, [isPlaying, relativeTime, clip.duration])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const drift = Math.abs(video.currentTime - mediaTime)
        const threshold = isPlaying ? 0.3 : 0.05

        if (drift > threshold) {
            video.currentTime = mediaTime
        }
    }, [mediaTime, isPlaying])

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = clip.volume ?? 1
        }
    }, [clip.volume])

    const getFilterStyle = () => {
        if (!clip.filter) return {}
        const { brightness, contrast, saturate, blur } = clip.filter
        return { filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) blur(${blur}px)` }
    }

    console.log('[PreviewPlayer] Rendering video:', clip.name, 'src:', clip.src)

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <div style={getCropStyle(clip)}>
                <video
                    ref={videoRef}
                    src={clip.src}
                    style={{ ...getMediaStyle(clip), ...getFilterStyle(), pointerEvents: 'none' }}
                    muted={clip.volume === 0}
                    playsInline
                    preload="auto"
                    onError={(e) => console.error('[PreviewPlayer] Video load error:', clip.src, e)}
                    onLoadedData={() => console.log('[PreviewPlayer] Video loaded successfully:', clip.src)}
                />
            </div>
        </div>
    )
}

function AudioClip({ clip, currentTime, isPlaying }: { clip: Clip, currentTime: number, isPlaying: boolean }) {
    const mediaRef = useRef<HTMLMediaElement>(null)
    const relativeTime = currentTime - clip.start
    const mediaTime = relativeTime + (clip.mediaStart || 0)

    const isVideoSource = clip.src.match(/\.(mp4|webm|mov|m4v)$|blob:/i)

    useEffect(() => {
        const media = mediaRef.current
        if (!media) return

        if (isPlaying && (relativeTime >= 0 && relativeTime <= clip.duration)) {
            media.play().catch((err) => {
                console.warn("Audio playback blocked or failed:", err)
            })
        } else {
            media.pause()
        }
    }, [isPlaying, relativeTime, clip.duration])

    useEffect(() => {
        const media = mediaRef.current
        if (!media) return

        const drift = Math.abs(media.currentTime - mediaTime)
        const threshold = isPlaying ? 0.3 : 0.05

        if (drift > threshold) {
            media.currentTime = mediaTime
        }
    }, [mediaTime, isPlaying])

    useEffect(() => {
        if (mediaRef.current) {
            mediaRef.current.volume = clip.volume ?? 1
        }
    }, [clip.volume])

    if (isVideoSource) {
        return (
            <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={clip.src}
                className="hidden"
                playsInline
                preload="auto"
            />
        )
    }

    return (
        <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={clip.src}
            preload="auto"
        />
    )
}

export function PreviewPlayer() {
    const {
        tracks,
        currentTime,
        duration,
        aspectRatio,
        setCurrentTime,
        canvasZoom,
        setCanvasZoom,
        selectedClipId,
        setSelectedClipId
    } = useStore()
    const [isPlaying, setIsPlaying] = useState(false)
    const requestRef = useRef<number | null>(null)
    const lastTimeRef = useRef<number>(0)
    const svgRef = useRef<SVGSVGElement>(null)

    const togglePlay = () => {
        if (!isPlaying) {
            lastTimeRef.current = performance.now()
        }
        setIsPlaying(!isPlaying)
    }

    useEffect(() => {
        if (isPlaying) {
            const animate = (time: number) => {
                const deltaTime = (time - lastTimeRef.current) / 1000
                lastTimeRef.current = time

                const now = useStore.getState().currentTime
                const nextTime = now + deltaTime

                if (nextTime >= useStore.getState().duration) {
                    setCurrentTime(useStore.getState().duration)
                    setIsPlaying(false)
                } else {
                    setCurrentTime(nextTime)
                    requestRef.current = requestAnimationFrame(animate)
                }
            }
            requestRef.current = requestAnimationFrame(animate)
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
        }
    }, [isPlaying, setCurrentTime])

    const formatTime = (seconds: number) => {
        const date = new Date(0)
        date.setSeconds(seconds)
        return date.toISOString().substr(11, 8)
    }

    const getShapePath = (shapeName: string): string => {
        switch (shapeName) {
            case 'Triangle': return 'M 50 0 L 100 100 L 0 100 Z'
            case 'Star': return 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z'
            case 'Arrow Right': return 'M 0 20 L 60 20 L 60 0 L 100 50 L 60 100 L 60 80 L 0 80 Z'
            case 'Heart': return 'M 50 90 L 48 88 C 10 55 0 35 0 20 C 0 10 10 0 25 0 C 35 0 45 10 50 20 C 55 10 65 0 75 0 C 90 0 100 10 100 20 C 100 35 90 55 52 88 L 50 90 Z'
            case 'Arrow': return 'M 50 0 L 50 70 M 50 70 L 20 40 M 50 70 L 80 40'
            default: return ''
        }
    }

    const projectWidth = 1920;
    const projectHeight = 1920 / (aspectRatio || 1);

    const renderClipContent = (clip: Clip) => {
        const x = clip.x || 0;
        const y = clip.y || 0;
        let w = clip.width || (projectWidth / 4);
        let h = clip.height || (projectHeight / 4);
        const r = clip.rotation || 0;

        // Text specific dimension override
        if (clip.type === 'text') {
            const dims = getTextDimensions(clip);
            w = dims.width;
            h = dims.height;
        }

        const commonProps = {
            x: 0,
            y: 0,
            width: w,
            height: h,
            opacity: clip.opacity ?? 1,
        }

        const getFilterStyle = (): React.CSSProperties => {
            if (!clip.filter) return {}
            const { brightness, contrast, saturate, blur } = clip.filter
            return { filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) blur(${blur}px)` }
        }

        const renderInner = () => {
            switch (clip.type) {
                case 'video':
                    return (
                        <foreignObject {...commonProps}>
                            <VideoClip clip={clip} currentTime={currentTime} isPlaying={isPlaying} />
                        </foreignObject>
                    )
                case 'audio':
                    return (
                        <foreignObject x={0} y={0} width={0} height={0}>
                            <AudioClip clip={clip} currentTime={currentTime} isPlaying={isPlaying} />
                        </foreignObject>
                    )
                case 'image':
                    console.log('[PreviewPlayer] Rendering image:', clip.name, 'src:', clip.src)
                    return (
                        <foreignObject {...commonProps}>
                            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...getFilterStyle() }}>
                                <div style={getCropStyle(clip)}>
                                    <img
                                        src={clip.src}
                                        style={getMediaStyle(clip)}
                                        alt=""
                                        onError={(e) => console.error('[PreviewPlayer] Image load error:', clip.src, e)}
                                        onLoad={() => console.log('[PreviewPlayer] Image loaded successfully:', clip.src)}
                                    />
                                </div>
                            </div>
                        </foreignObject>
                    )
                case 'text':
                    // Auto-calculate text dimensions based on font size and content
                    const fontSize = clip.fontSize || 120;
                    const textContent = clip.text || 'Text';
                    // Dimensions are already calculated in w and h

                    return (
                        <foreignObject
                            x={0}
                            y={0}
                            width={w}
                            height={h}
                            opacity={clip.opacity ?? 1}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: `${fontSize}px`,
                                    color: clip.color || 'white',
                                    fontFamily: clip.fontFamily || 'sans-serif',
                                    fontWeight: 'bold',
                                    textShadow: '0 0.2px 0.4px rgba(0,0,0,0.5)',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center'
                                }}
                            >
                                {textContent}
                            </div>
                        </foreignObject>
                    )
                case 'icon':
                case 'shape':
                    if (clip.type === 'icon' || (clip.src && (clip.src.toLowerCase().split('?')[0].endsWith('.svg') || clip.src.includes('blob:') || clip.src.startsWith('data:image/svg+xml')))) {
                        return (
                            <foreignObject
                                x={0}
                                y={0}
                                width={w}
                                height={h}
                                style={{ opacity: clip.opacity ?? 1 }}
                            >
                                <DynamicSvg
                                    src={clip.src}
                                    templateData={clip.templateData}
                                    fill={clip.color}
                                />
                            </foreignObject>
                        )
                    }
                    if (clip.src === 'Rectangle') {
                        return <rect {...commonProps} fill={clip.color || 'white'} />
                    }
                    if (clip.src === 'Circle') {
                        const cx = w / 2
                        const cy = h / 2
                        const rRadius = Math.min(w, h) / 2
                        return (
                            <circle
                                cx={cx}
                                cy={cy}
                                r={rRadius}
                                fill={clip.color || 'white'}
                            />
                        )
                    }
                    return (
                        <svg
                            {...commonProps}
                            viewBox={clip.viewBox || "0 0 100 100"}
                            preserveAspectRatio="none"
                        >
                            <path
                                d={clip.customPath || getShapePath(clip.src)}
                                fill={clip.color || 'white'}
                                stroke={clip.src === 'Arrow' ? (clip.color || 'white') : 'none'}
                                strokeWidth={clip.src === 'Arrow' ? 5 : 0}
                            />
                        </svg>
                    )
                default:
                    return null
            }
        }

        // Calculate rotation center accounting for crop - Reverted to simpler center calculation if needed
        // But since we reverted to clip-path, w and h are the clip dimensions.
        const rotationCenterX = w / 2;
        const rotationCenterY = h / 2;

        if (clip.type === 'audio') {
            return renderInner();
        }

        return (
            <g
                transform={`translate(${x}, ${y}) rotate(${r}, ${rotationCenterX}, ${rotationCenterY})`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedClipId(clip.id);
                }}
                className="cursor-pointer"
            >
                {renderInner()}
                <rect
                    width={w}
                    height={h}
                    fill="transparent"
                    pointerEvents="auto"
                />
            </g>
        )
    }

    const activeClips = React.useMemo(() => {
        return tracks
            .flatMap((track, trackIndex) => track.clips.map(clip => ({ ...clip, trackOrder: trackIndex })))
            .filter(clip => currentTime >= clip.start && currentTime < clip.start + clip.duration)
            .sort((a, b) => b.trackOrder - a.trackOrder)
    }, [tracks, currentTime]);

    return (
        <div className="flex flex-1 flex-col bg-black/5 overflow-hidden">
            <div className="flex-1 overflow-auto flex p-8 bg-black/10">
                <div
                    id="preview-container"
                    className="relative transition-all duration-200 m-auto inverse-scaling-target preview-container"
                    style={{
                        transformOrigin: 'center center',
                    }}
                >
                    <div
                        className="rounded-lg border bg-black shadow-lg relative group shrink-0"
                        style={{
                            aspectRatio: `${aspectRatio}`,
                            width: aspectRatio > 1 ? `${800 * (canvasZoom / 100)}px` : `${(800 * aspectRatio) * (canvasZoom / 100)}px`,
                            height: aspectRatio > 1 ? `${(800 / aspectRatio) * (canvasZoom / 100)}px` : `${800 * (canvasZoom / 100)}px`,
                            maxWidth: 'none',
                            maxHeight: 'none'
                        }}
                    >
                        {activeClips.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-white/20 pointer-events-none">
                                <span>No active clips</span>
                            </div>
                        )}

                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${projectWidth} ${projectHeight}`}
                            className="absolute inset-0 w-full h-full overflow-visible"
                            onMouseDown={() => setSelectedClipId(null)}
                        >
                            {activeClips.map(clip => (
                                <React.Fragment key={clip.id}>
                                    {renderClipContent(clip)}
                                    {selectedClipId === clip.id && clip.type !== 'audio' && (
                                        <TransformControls
                                            clip={clip}
                                            projectWidth={projectWidth}
                                            projectHeight={projectHeight}
                                            svgRef={svgRef}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </svg>
                    </div>
                </div>
            </div>

            <div className="h-20 border-t bg-background px-6 flex flex-col justify-center gap-2">
                <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentTime(0)}>
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={togglePlay} className="h-10 w-10">
                            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentTime(duration)}>
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">{formatTime(currentTime)}</span>
                        <Slider
                            value={[currentTime]}
                            max={duration}
                            step={0.1}
                            className="flex-1"
                            onValueChange={(val) => {
                                setCurrentTime(val[0])
                                setIsPlaying(false)
                            }}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-12">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center gap-3 border-l pl-6">
                        <ZoomOut className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setCanvasZoom(Math.max(10, canvasZoom - 10))} />
                        <div className="w-32 flex flex-col gap-1">
                            <Slider
                                value={[canvasZoom]}
                                min={10}
                                max={500}
                                step={1}
                                onValueChange={(val) => setCanvasZoom(val[0])}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-medium text-muted-foreground">Preview Zoom</span>
                                <span className="text-[10px] font-bold text-primary">{canvasZoom}%</span>
                            </div>
                        </div>
                        <ZoomIn className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setCanvasZoom(Math.min(500, canvasZoom + 10))} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCanvasZoom(100)}>
                            <Search className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
