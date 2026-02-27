import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Search, Loader2 } from "lucide-react"
import { useStore, type Clip } from "@/features/editor/store/useStore"
import React, { useEffect, useRef, useState } from "react"
import { DynamicSvg } from "./DynamicSvg"
import { TransformControls } from "./TransformControls"
import { getTextDimensions } from '@/utils/text'

const getMediaStyle = (clip: Clip): React.CSSProperties => {
    // Only handle sizing here, transforms are moved to parent G
    return {
        width: '100%',
        height: '100%',
        objectFit: clip.type === 'mask' ? 'contain' : 'fill',
        pointerEvents: 'none'
    }
}

function VideoClip({ clip, currentTime, isPlaying, onReady, forceCheck }: { clip: Clip, currentTime: number, isPlaying: boolean, onReady?: (id: string) => void, forceCheck: number }) {
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

        const checkReady = () => {
            if (video.readyState >= 2) {
                onReady?.(clip.id)
            }
        }

        // Check immediately
        checkReady()

        const interval = setInterval(checkReady, 500) // Fallback poll

        video.addEventListener('canplay', checkReady)
        video.addEventListener('loadeddata', checkReady)

        return () => {
            clearInterval(interval)
            video.removeEventListener('canplay', checkReady)
            video.removeEventListener('loadeddata', checkReady)
        }
    }, [clip.src, onReady, forceCheck])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const drift = Math.abs(video.currentTime - mediaTime)
        const threshold = isPlaying ? 0.3 : 0.05

        // Only sync if visible time diff is significant
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

    // console.log('[PreviewPlayer] Rendering video:', clip.name, 'src:', clip.src)

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <video
                draggable={false}
                className="select-none"
                ref={videoRef}
                src={clip.src}
                style={{ ...getMediaStyle(clip), ...getFilterStyle() }}
                muted={clip.volume === 0}
                playsInline
                preload="auto"
                onError={(e) => {
                    console.error('[PreviewPlayer] Video load error:', clip.src, e)
                    // Mark as ready even on error to prevent blocking
                    onReady?.(clip.id)
                }}
                onLoadedData={() => {
                    onReady?.(clip.id);
                }}
                onCanPlay={() => {
                    onReady?.(clip.id);
                }}
            />
        </div>
    )
}

function AudioClip({ clip, currentTime, isPlaying, onReady, forceCheck }: { clip: Clip, currentTime: number, isPlaying: boolean, onReady?: (id: string) => void, forceCheck: number }) {
    const mediaRef = useRef<HTMLMediaElement>(null)
    const relativeTime = currentTime - clip.start
    const mediaTime = relativeTime + (clip.mediaStart || 0)
    const isVideoSource = clip.mediaType === 'video' || (clip.src && clip.src.match(/\.(mp4|webm|mov|m4v)$/i));

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

        const checkReady = () => {
            if (media.readyState >= 2) {
                onReady?.(clip.id)
            }
        }

        checkReady()
        media.addEventListener('canplay', checkReady)
        media.addEventListener('loadeddata', checkReady)

        return () => {
            media.removeEventListener('canplay', checkReady)
            media.removeEventListener('loadeddata', checkReady)
        }
    }, [clip.src, onReady, forceCheck])

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
            onLoadedData={() => onReady?.(clip.id)}
            onCanPlay={() => onReady?.(clip.id)}
            onError={() => onReady?.(clip.id)}
        />
    )
}
function ImageClip({ clip, onReady, forceCheck }: { clip: Clip, onReady?: (id: string) => void, forceCheck: number }) {
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const img = imgRef.current
        if (!img) return

        const checkReady = () => {
            if (img.complete) {
                // Try to decode if supported for smoother playback start
                if ('decode' in img) {
                    img.decode()
                        .then(() => {
                            onReady?.(clip.id)
                        })
                        .catch((err) => {
                            console.warn(`Image decode failed for ${clip.id}`, err)
                            onReady?.(clip.id)
                        })
                } else {
                    onReady?.(clip.id)
                }
            }
        }

        checkReady()
    }, [forceCheck, onReady, clip.src])

    return (
        <img
            draggable={false}
            className="select-none"
            src={clip.src}
            style={getMediaStyle(clip)}
            alt=""
            ref={imgRef}
            onLoad={() => {
                // Check ready logic will handle it via effect or we can call it here too
                // but effect is safer particularly if cached.
                // Actually onLoad is good trigger for decode too.
                if (imgRef.current) {
                    const img = imgRef.current;
                    if ('decode' in img) {
                        img.decode().then(() => onReady?.(clip.id)).catch(() => onReady?.(clip.id));
                    } else {
                        onReady?.(clip.id);
                    }
                }
            }}
            onError={(e) => {
                console.error('[PreviewPlayer] Image load error:', clip.src, e);
                onReady?.(clip.id);
            }}
        />
    )
}

export function PreviewPlayer() {
    const {
        tracks,
        currentTime,
        duration,
        aspectRatio,
        projectWidth,
        projectHeight,
        setCurrentTime,
        canvasZoom,
        setCanvasZoom,
        selectedClipId,
        setSelectedClipId,
        addClip,
        addTrack
    } = useStore()
    const [isPlaying, setIsPlaying] = useState(false)
    const [readyAssets, setReadyAssets] = useState<Set<string>>(new Set())
    const [forceCheck, setForceCheck] = useState(0)
    const requestRef = useRef<number | null>(null)
    const lastTimeRef = useRef<number>(0)
    const svgRef = useRef<SVGSVGElement>(null)

    const handleReady = React.useCallback((id: string) => {
        setReadyAssets(prev => {
            if (prev.has(id)) return prev
            const next = new Set(prev)
            next.add(id)
            return next
        })
    }, [])

    // Reset ready assets when time changes significantly (seeking)
    useEffect(() => {
        if (!isPlaying) {
            setReadyAssets(new Set())
            setForceCheck(prev => prev + 1)
        }
    }, [currentTime, isPlaying])

    const activeClips = React.useMemo(() => {
        return tracks
            .flatMap((track, trackIndex) => track.clips.map(clip => ({ ...clip, trackOrder: trackIndex })))
            .filter(clip => {
                const clipEnd = clip.start + clip.duration
                // Standard check: within range [start, end)
                if (currentTime >= clip.start && currentTime < clipEnd) return true
                // Special case: if we are at the very end of the project, show clips that end exactly there
                if (currentTime === duration && currentTime === clipEnd) return true
                return false
            })
            .sort((a, b) => b.trackOrder - a.trackOrder)
    }, [tracks, currentTime, duration]);

    const isReady = React.useMemo(() => {
        // Clips that need explicit loading
        const clipsRequiringLoading = activeClips.filter(c =>
            ['audio', 'mask', 'icon', 'shape'].includes(c.type)
        );
        return clipsRequiringLoading.every(c => readyAssets.has(c.id));
    }, [activeClips, readyAssets]);

    // Automatically mark non-async assets as ready
    useEffect(() => {
        const nonAsyncIds = activeClips
            .filter(c =>
                c.type === 'text' ||
                (c.type === 'shape' && !c.src?.toLowerCase().endsWith('.svg'))
            )
            .map(c => c.id)
            .filter(id => !readyAssets.has(id));

        if (nonAsyncIds.length > 0) {
            setReadyAssets(prev => {
                const next = new Set(prev);
                nonAsyncIds.forEach(id => next.add(id));
                return next;
            });
        }
    }, [activeClips, readyAssets]);

    const togglePlay = () => {
        // Reset ready assets and force check whenever playback is initiated or restarted
        // This ensures all assets are re-evaluated for readiness.
        setReadyAssets(new Set())
        setForceCheck(prev => prev + 1)

        // If at the end, restart from beginning
        if (currentTime >= duration) {
            setCurrentTime(0)
            setIsPlaying(true)
            lastTimeRef.current = performance.now()
            return
        }

        if (!isPlaying) {
            setReadyAssets(new Set())
            setForceCheck(prev => prev + 1)
            lastTimeRef.current = performance.now()
        }
        setIsPlaying((prev) => !prev)
    }

    useEffect(() => {
        if (isPlaying) {
            const animate = (time: number) => {
                const deltaTime = (time - lastTimeRef.current) / 1000
                lastTimeRef.current = time

                // ONLY advance time if resources are ready
                if (!isReady) {
                    requestRef.current = requestAnimationFrame(animate)
                    return
                }

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
    }, [isPlaying, isReady, setCurrentTime])

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
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        const data = e.dataTransfer.getData("application/json")
        if (!data) return

        try {
            const { type, src, customPath, name, templateData, viewBox, mediaType } = JSON.parse(data)

            if (!svgRef.current) return
            const rect = svgRef.current.getBoundingClientRect()
            
            // Calculate absolute x and y within the SVG relative to the element
            const clientX = e.clientX - rect.left
            const clientY = e.clientY - rect.top
            
            // Map to project coordinates using current canvasZoom and aspect ratio
            const scale = canvasZoom / 100
            const displayWidth = aspectRatio > 1 ? 800 * scale : (800 * aspectRatio) * scale
            const displayHeight = aspectRatio > 1 ? (800 / aspectRatio) * scale : 800 * scale
            
            // Get proper scale factor between rendered size and project coordinates
            const scaleX = projectWidth / displayWidth
            const scaleY = projectHeight / displayHeight

            let finalX = clientX * scaleX
            let finalY = clientY * scaleY

            const videoDuration = type === 'mask' || type === 'text' || type === 'shape' || type === 'icon' ? duration : 10
            import('uuid').then(({ v4: uuidv4 }) => {
                const clipId = uuidv4()

                // Calculate dimensions based on resource type
                let width = 500; // Default fallback
                let height = 500;
                let actualDuration = videoDuration;
                let resolvedMediaType = mediaType;

                const processClipCreation = async () => {
                    if (type === 'mask') {
                        // Determine if it's video or image based on mediaType or src heuristics
                        const isVideo = resolvedMediaType === 'video' || src.match(/\.(mp4|webm|mov|m4v)$/i) || src.startsWith('blob:video/');
                        resolvedMediaType = isVideo ? 'video' : 'image';

                        if (isVideo) {
                            try {
                                const video = document.createElement('video');
                                video.preload = 'metadata';
                                video.src = src;
                                video.load();

                                await new Promise((resolve, reject) => {
                                    video.onloadedmetadata = resolve;
                                    video.onerror = reject;
                                    setTimeout(() => reject(new Error('Video load timeout')), 3000);
                                });

                                const aspect = video.videoWidth / video.videoHeight;
                                if (video.videoWidth > 1000 || video.videoHeight > 1000) {
                                    if (aspect > 1) {
                                        width = 1000;
                                        height = 1000 / aspect;
                                    } else {
                                        height = 1000;
                                        width = 1000 * aspect;
                                    }
                                } else {
                                    width = video.videoWidth;
                                    height = video.videoHeight;
                                }

                                if (video.duration && isFinite(video.duration)) {
                                    actualDuration = Math.min(video.duration, duration);
                                }
                            } catch (err) {
                                console.error("Failed to load video metadata", err)
                            }
                        } else {
                            // Image
                            try {
                                const img = new Image();
                                img.src = src;
                                await new Promise((resolve, reject) => {
                                    img.onload = resolve;
                                    img.onerror = reject;
                                });

                                const aspect = img.naturalWidth / img.naturalHeight;
                                if (img.naturalWidth > 1000 || img.naturalHeight > 1000) {
                                    if (aspect > 1) {
                                        width = 1000;
                                        height = 1000 / aspect;
                                    } else {
                                        height = 1000;
                                        width = 1000 * aspect;
                                    }
                                } else {
                                    width = img.naturalWidth;
                                    height = img.naturalHeight;
                                }
                            } catch (err) {
                                console.error("Failed to load image metadata", err)
                            }
                        }
                    } else if (type === 'text') {
                        width = 600;
                        height = 150;
                    } else if (type === 'shape' || type === 'icon') {
                        if (viewBox) {
                            const [_x, _y, vW, vH] = viewBox.split(' ').map(Number);
                            if (!isNaN(vW) && !isNaN(vH) && vH > 0) {
                                const aspect = vW / vH;
                                if (aspect > 1) {
                                    width = 200;
                                    height = 200 / aspect;
                                } else {
                                    height = 200;
                                    width = 200 * aspect;
                                }
                            } else {
                                width = 200;
                                height = 200;
                            }
                        } else {
                            width = 200;
                            height = 200;
                        }
                    }

                    // Center the dropped item on the mouse pointer instead of placing its top-left corner there
                    const centeredX = finalX - (width / 2);
                    const centeredY = finalY - (height / 2);

                    const typeNameMap: Record<string, string> = {
                        'mask': '마스크',
                        'audio': '오디오',
                        'text': '텍스트',
                        'shape': '도형',
                        'icon': '아이콘'
                    };

                    const allClips = tracks.flatMap(t => t.clips);
                    const typeClips = allClips.filter(c => c.type === type);
                    const typeName = typeNameMap[type] || type;
                    const pattern = new RegExp(`^새\\s+${typeName}\\s+클립\\s+(\\d+)$`);
                    let maxSequence = 0;

                    typeClips.forEach(clip => {
                        const match = clip.name.match(pattern);
                        if (match) {
                            const num = parseInt(match[1], 10);
                            if (num > maxSequence) {
                                maxSequence = num;
                            }
                        }
                    });

                    const sequenceNumber = maxSequence + 1;
                    const generatedName = `새 ${typeName} 클립 ${sequenceNumber}`;

                    const newClipData: Clip = {
                        id: clipId,
                        type: type as any,
                        trackId: '', // placeholder, will be filled
                        mediaType: resolvedMediaType as 'video' | 'image' | undefined,
                        start: currentTime,
                        duration: actualDuration,
                        name: name || (type === 'text' ? src : (customPath ? 'Custom Shape' : generatedName)),
                        src,
                        text: type === 'text' ? 'New Text' : undefined,
                        fontFamily: type === 'text' ? src : undefined,
                        customPath,
                        viewBox,
                        templateData,
                        volume: (type === 'mask' && (src.match(/\.(mp4|webm|mov|m4v)$/i) || src.startsWith('blob:video/'))) || type === 'audio' ? 1 : undefined,
                        width,
                        height,
                        x: centeredX,
                        y: centeredY
                    };

                    if (type === 'text') {
                        const { loadFont } = require('@/utils/fonts');
                        loadFont({
                            family: src,
                            url: `/assets/font/${src}.woff`
                        });
                    }

                    // Always create a new track when dropped precisely on canvas to ensure it's layered correctly
                    addTrack(type as any, 0);
                    
                    setTimeout(() => {
                        // Needs to pull from fresh state because addTrack is async to this scope locally
                        const updatedTracks = useStore.getState().tracks;
                        const newTrack = updatedTracks[0];

                        if (newTrack) {
                            addClip(newTrack.id, { ...newClipData, trackId: newTrack.id })
                            setSelectedClipId(clipId)
                        }
                    }, 0);
                }

                processClipCreation();
            })
        } catch (err) {
            console.error("Failed to parse drop data in PreviewPlayer", err)
        }
    }

    const renderClipContent = (clip: Clip) => {
        const x = clip.x || 0;
        const y = clip.y || 0;
        let w = clip.width || (projectWidth / 4);
        let h = clip.height || (projectHeight / 4);
        const r = clip.rotation || 0;
        const flipH = clip.flipH || false;
        const flipV = clip.flipV || false;

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

        // Clip Template Data for Mask
        const maskId = `mask-${clip.id}`;
        const hasMask = clip.type !== 'text' && clip.type !== 'audio' && clip.type !== 'shape' && clip.type !== 'icon' && clip.templateData && Object.keys(clip.templateData).length > 0;

        const renderMaskDefs = () => {
            if (!hasMask) return null;

            // Calculate scale based on viewBox vs rendered size
            // Default legacy bounds 100x100 if no viewBox
            let vbx = 0, vby = 0, vbw = 100, vbh = 100;
            if (clip.viewBox) {
                // Robust parsing for comma or space separated numbers
                const parts = clip.viewBox.split(/[ ,]+/).filter(Boolean).map(Number);
                if (parts.length === 4) {
                    [vbx, vby, vbw, vbh] = parts;
                }
            }

            // Scale mask to fit current dimensions
            // Protect against division by zero
            const safeVbw = vbw === 0 ? 100 : vbw;
            const safeVbh = vbh === 0 ? 100 : vbh;

            const sx = w / safeVbw;
            const sy = h / safeVbh;

            return (
                <defs>
                    <mask id={maskId}>
                        <rect x="0" y="0" width="100%" height="100%" fill="black" />
                        <g transform={`scale(${sx}, ${sy}) translate(${-vbx}, ${-vby})`}>
                            {Object.values(clip.templateData).map((data: any, index: number) => (
                                <path key={data.id || index} d={data.d} fill="white" />
                            ))}
                        </g>
                    </mask>
                </defs>
            );
        };

        const renderInner = () => {
            switch (clip.type) {
                case 'audio':
                    return (
                        <foreignObject x={0} y={0} width={0} height={0}>
                            <AudioClip clip={clip} currentTime={currentTime} isPlaying={isPlaying && isReady} onReady={() => handleReady(clip.id)} forceCheck={forceCheck} />
                        </foreignObject>
                    )
                case 'mask':
                    // Determine subtype based on src and mediaType
                    const isVideo = clip.mediaType === 'video' || (clip.src && clip.src.match(/\.(mp4|webm|mov|m4v)$/i));
                    const isSvg = clip.src && (clip.src.toLowerCase().split('?')[0].endsWith('.svg') || clip.src.startsWith('data:image/svg+xml'));

                    if (isVideo) {
                        return (
                            <g>
                                {renderMaskDefs()}
                                <foreignObject {...commonProps} mask={hasMask ? `url(#${maskId})` : undefined}>
                                    <VideoClip clip={clip} currentTime={currentTime} isPlaying={isPlaying && isReady} onReady={() => handleReady(clip.id)} forceCheck={forceCheck} />
                                </foreignObject>
                            </g>
                        )
                    } else if (isSvg && !clip.src.startsWith('blob:')) {
                        return (
                            <g>
                                {renderMaskDefs()}
                                <foreignObject {...commonProps} mask={hasMask ? `url(#${maskId})` : undefined}>
                                    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                                        <DynamicSvg
                                            src={clip.src}
                                            templateData={clip.templateData}
                                            fill={clip.color}
                                            mask={clip.mask}
                                            filter={clip.filter}
                                            onLoad={() => handleReady(clip.id)}
                                            forceCheck={forceCheck}
                                        />
                                    </div>
                                </foreignObject>
                            </g>
                        )
                    } else {
                        // Default to Image
                        return (
                            <g>
                                {renderMaskDefs()}
                                <foreignObject {...commonProps} mask={hasMask ? `url(#${maskId})` : undefined}>
                                    <ImageClip clip={clip} onReady={() => handleReady(clip.id)} forceCheck={forceCheck} />
                                </foreignObject>
                            </g>
                        )
                    }
                case 'text':
                    const fontSize = clip.fontSize || 120;
                    const textContent = clip.text || 'Text';

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
                                    fontFamily: `"${clip.fontFamily || 'sans-serif'}"`,
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
                                    onLoad={() => handleReady(clip.id)}
                                    forceCheck={forceCheck}
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
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clip.type === 'mask' || clip.type === 'audio') {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        useStore.getState().setEditingClipId(clip.id);
                    }
                }}
                className="cursor-pointer"
            >
                {/* Apply flip transforms here on the container group of content */}
                <g transform={`translate(${w / 2}, ${h / 2}) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) translate(${-w / 2}, ${-h / 2})`}>
                    {renderInner()}
                </g>
                <rect
                    width={w}
                    height={h}
                    fill="transparent"
                    pointerEvents="auto"
                />
            </g>
        )
    }

    return (
        <div className="flex flex-1 flex-col bg-black/5 overflow-hidden select-none">
            <div className="flex-1 overflow-auto bg-black/10 relative flex flex-col">
                <div className="flex-1 shrink-0 min-h-0" />
                <div className="flex justify-center items-center shrink-0 p-8">
                    <div
                        id="preview-container"
                        className="relative transition-all duration-200 inverse-scaling-target preview-container"
                        style={{
                            transformOrigin: 'center center',
                        }}
                    >
                        <div
                            className="border bg-black shadow-lg relative group shrink-0"
                        style={{
                            boxSizing: 'content-box',
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

                        {isPlaying && !isReady && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-lg">
                                <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                                <span className="text-white text-xs font-medium">Loading resources...</span>
                            </div>
                        )}

                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${projectWidth} ${projectHeight}`}
                            className="absolute inset-0 w-full h-full overflow-visible"
                            onMouseDown={() => setSelectedClipId(null)}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {activeClips.map(clip => {
                                console.log(`[PreviewPlayer Debug] Clip ${clip.id} - w: ${clip.width}, h: ${clip.height}, projectWidth: ${projectWidth}`);
                                return (
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
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>
            <div className="flex-1 shrink-0 min-h-0" />
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
