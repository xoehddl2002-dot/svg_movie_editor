import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Plus, Trash2 } from "lucide-react"
import { useStore } from "@/features/editor/store/useStore"
import { Track } from "./Track"
import { Ruler } from "./Ruler"
import React, { useRef, useEffect } from "react"
import { v4 as uuidv4 } from 'uuid'

export function Timeline() {
    const {
        tracks, currentTime, duration, zoom,
        setZoom, setCurrentTime, setDuration, addClip, setSelectedClipId, removeClip, selectedClipId, addTrack,
        timelineHeight, setAspectRatio, moveClip
    } = useStore()

    const svgRef = useRef<SVGSVGElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDraggingPlayhead = useRef(false)
    const dragState = useRef<{
        clipId: string;
        initialMouseX: number;
        initialMouseY: number;
        initialStart: number;
        initialTrackIndex: number;
    } | null>(null)
    const resizeState = useRef<{
        clipId: string;
        direction: 'start' | 'end';
        initialMouseX: number;
        initialStart: number;
        initialDuration: number;
    } | null>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
                if (window.confirm("Delete selected item?")) {
                    removeClip(selectedClipId)
                }
            }
        }

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDraggingPlayhead.current) {
                updatePlayheadPosition(e)
            } else if (resizeState.current) {
                const { clipId, direction, initialMouseX, initialStart, initialDuration } = resizeState.current;
                const dx = e.clientX - initialMouseX;
                const deltaTime = dx / zoom;

                let newStart = initialStart;
                let newDuration = initialDuration;

                if (direction === 'start') {
                    const proposedStart = initialStart + deltaTime;
                    const maxStart = initialStart + initialDuration - 0.1;

                    newStart = Math.min(Math.max(0, proposedStart), maxStart);
                    newDuration = initialDuration - (newStart - initialStart);

                    useStore.getState().updateClip(clipId, { start: newStart, duration: newDuration });
                } else {
                    const proposedDuration = initialDuration + deltaTime;
                    newDuration = Math.max(0.1, proposedDuration);

                    useStore.getState().updateClip(clipId, { duration: newDuration });
                }

            } else if (dragState.current) {
                const { clipId, initialMouseX, initialMouseY, initialStart, initialTrackIndex } = dragState.current;

                const dx = e.clientX - initialMouseX;
                const deltaTime = dx / zoom;
                const newStart = Math.max(0, initialStart + deltaTime);

                const dy = e.clientY - initialMouseY;
                const deltaTrack = Math.round(dy / 50);
                const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, initialTrackIndex + deltaTrack));
                const targetTrack = tracks[newTrackIndex];
                const newTrackId = targetTrack.id;

                // Find current track of the clip
                let currentTrackId = '';
                for (const t of tracks) {
                    if (t.clips.find(c => c.id === clipId)) {
                        currentTrackId = t.id;
                        break;
                    }
                }

                if (currentTrackId && newTrackId !== currentTrackId) {
                    // Check if target track has items
                    if (targetTrack.clips.length > 0) {
                        // Swap contents
                        // We also need to update the clip's start time AFTER swap
                        // But swapTrackContents swaps IDs.
                        // We need to execute swap, then update start.
                        // useStore actions are sync.
                        useStore.getState().swapTrackContents(currentTrackId, newTrackId);
                        useStore.getState().updateClip(clipId, { start: newStart });
                    } else {
                        // Empty track, just move
                        moveClip(clipId, newTrackId, { start: newStart });
                    }
                } else {
                    // Same track, just update time
                    moveClip(clipId, newTrackId, { start: newStart });
                }
            }
        }

        const handleGlobalMouseUp = () => {
            isDraggingPlayhead.current = false
            dragState.current = null
            resizeState.current = null
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('mousemove', handleGlobalMouseMove)
        window.addEventListener('mouseup', handleGlobalMouseUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('mousemove', handleGlobalMouseMove)
            window.removeEventListener('mouseup', handleGlobalMouseUp)
        }
    }, [selectedClipId, removeClip, duration, zoom, tracks, moveClip])

    const updatePlayheadPosition = (e: MouseEvent | React.MouseEvent) => {
        if (!svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const viewDuration = 300 // 5 minutes
        const newTime = Math.max(0, Math.min(viewDuration, x / zoom))
        setCurrentTime(newTime)
    }

    const handlePlayheadDragStart = (e: React.MouseEvent) => {
        e.stopPropagation()
        isDraggingPlayhead.current = true
    }

    const handleClipDragStart = (e: React.MouseEvent, clipId: string) => {
        e.stopPropagation()
        setSelectedClipId(clipId)

        let initialTrackIndex = -1;
        let initialStart = 0;
        tracks.forEach((track, index) => {
            const clip = track.clips.find(c => c.id === clipId);
            if (clip) {
                initialTrackIndex = index;
                initialStart = clip.start;
            }
        });

        if (initialTrackIndex !== -1) {
            dragState.current = {
                clipId,
                initialMouseX: e.clientX,
                initialMouseY: e.clientY,
                initialStart,
                initialTrackIndex
            }
        }
    }

    const handleClipResizeStart = (e: React.MouseEvent, clipId: string, direction: 'start' | 'end') => {
        e.stopPropagation()
        // No need to set selectedClipId strictly, but good for UX
        setSelectedClipId(clipId)

        let initialStart = 0;
        let initialDuration = 0;

        let found = false;
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === clipId)
            if (clip) {
                initialStart = clip.start;
                initialDuration = clip.duration;
                found = true;
                break;
            }
        }

        if (found) {
            resizeState.current = {
                clipId,
                direction,
                initialMouseX: e.clientX,
                initialStart,
                initialDuration
            }
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        const data = e.dataTransfer.getData("application/json")
        if (!data) return

        try {
            const { type, src, customPath, name, templateData, templateCategory, viewBox, mediaType } = JSON.parse(data)

            // Adjust aspect ratio based on template category
            if (templateCategory === 'F') setAspectRatio(1920 / 1080)
            else if (templateCategory === 'S') setAspectRatio(348 / 819)
            else if (templateCategory === 'T') setAspectRatio(1820 / 118)

            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const dropTime = Math.max(0, x / zoom)

            const videoDuration = type === 'mask' || type === 'text' || type === 'shape' || type === 'icon' ? duration : 10
            const clipId = uuidv4()

            // Calculate dimensions based on resource type
            let width = 500; // Default fallback
            let height = 500;
            let actualDuration = videoDuration;
            let resolvedMediaType = mediaType;

            if (type === 'mask') {
                // Determine if it's video or image based on mediaType or src heuristics
                const isVideo = resolvedMediaType === 'video' || src.match(/\.(mp4|webm|mov|m4v)$/i) || src.startsWith('blob:video/');
                resolvedMediaType = isVideo ? 'video' : 'image';

                if (isVideo) {
                    try {
                        const video = document.createElement('video');
                        video.preload = 'metadata';
                        video.src = src;

                        // Force load
                        video.load();

                        await new Promise((resolve, reject) => {
                            video.onloadedmetadata = resolve;
                            video.onerror = reject;
                            // Add timeout to avoid hanging
                            setTimeout(() => reject(new Error('Video load timeout')), 3000);
                        });

                        const aspect = video.videoWidth / video.videoHeight;
                        // Standard video size in preview
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
                            // Cap at project duration if longer, otherwise keep video duration
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


            // Relative Y inside the content container checks
            const relativeY = e.clientY - rect.top;
            const rulerHeight = 30;
            const trackHeight = 50;

            let trackIndex = -1;
            let createNewTrack = false;
            let insertIndex = -1;

            if (relativeY < rulerHeight + 10) {
                createNewTrack = true;
                insertIndex = 0;
            } else {
                const yInTracks = relativeY - rulerHeight;
                trackIndex = Math.floor(yInTracks / trackHeight);

                if (trackIndex >= tracks.length) {
                    if (trackIndex === tracks.length) {
                        createNewTrack = true;
                        insertIndex = tracks.length;
                    }
                } else if (trackIndex >= 0) {
                    const targetTrack = tracks[trackIndex];
                    if (targetTrack.clips.length > 0) {
                        createNewTrack = true;
                        insertIndex = trackIndex;
                    } else {
                        createNewTrack = false;
                    }
                }
            }

            // Generate dynamic Korean clip name based on type and count
            const typeNameMap: Record<string, string> = {
                'mask': '마스크', // Generic mask, could be Image or Video content
                'audio': '오디오',
                'text': '텍스트',
                'shape': '도형',
                'icon': '아이콘'
            };

            // Find the maximum sequence number for this type
            const allClips = tracks.flatMap(t => t.clips);
            const typeClips = allClips.filter(c => c.type === type);

            // Extract sequence numbers from existing clips of the same type
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

            const newClipData = {
                id: clipId,
                type,
                mediaType: resolvedMediaType as 'video' | 'image' | undefined,
                start: dropTime,
                duration: actualDuration,
                name: name || (type === 'text' ? src : (customPath ? 'Custom Shape' : generatedName)),
                src,
                text: type === 'text' ? 'New Text' : undefined,
                fontFamily: type === 'text' ? src : undefined,
                customPath,
                viewBox,
                templateData,
                volume: (type === 'mask' && (src.match(/\.(mp4|webm|mov|m4v)$/i) || src.startsWith('blob:video/'))) || type === 'audio' ? 1 : undefined,
                // Add calculated dimensions
                width,
                height,
                x: (1920 - width) / 2, // Center horizontally roughly (assuming 1920 base)
                y: (1080 - height) / 2  // Center vertically roughly
            };

            // Auto-load font if text clip
            if (type === 'text') {
                const { loadFont } = require('@/utils/fonts');
                loadFont({
                    family: src,
                    url: `/assets/font/${src}.woff`
                });
            }

            if (createNewTrack) {
                // Use the type of the item being dropped to organize tracks
                addTrack(type as any, insertIndex);
                // Need to wait strictly or use ID prediction? 
                // Since we need to wait for state update in a sync manner usually, but we are async now.
                // We can fetch state again.
                // However, addTrack is sync. Zustand updates are sync.
                const updatedTracks = useStore.getState().tracks;
                const newTrack = updatedTracks[insertIndex];

                if (newTrack) {
                    addClip(newTrack.id, { ...newClipData, trackId: newTrack.id })
                }
            } else if (trackIndex >= 0 && trackIndex < tracks.length) {
                const trackId = tracks[trackIndex].id
                addClip(trackId, { ...newClipData, trackId })
            }
        } catch (err) {
            console.error("Failed to parse drop data", err)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const totalTrackHeight = 30 + (tracks.length * 50)

    return (
        <div
            className="group/timeline border-t bg-background flex flex-col select-none prevent-deselect transition-[height] duration-200"
            style={{ height: timelineHeight }}
        >
            {/* Timeline Toolbar */}
            <div className="h-10 border-b flex items-center px-4 justify-between bg-muted/30 shrink-0 z-20 relative">
                <div className="flex gap-4 text-xs text-muted-foreground w-1/2 items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 flex items-center gap-1 shrink-0"
                        onClick={() => addTrack('mixed')}
                    >
                        <Plus className="h-4 w-4" />
                        Add Track
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 flex items-center gap-1 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                        disabled={!selectedClipId}
                        onClick={() => {
                            if (selectedClipId && window.confirm("Delete selected item?")) {
                                removeClip(selectedClipId);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                    <input
                        type="range"
                        min="5"
                        max="200"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                    />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground items-center">
                    <div className="flex items-center gap-2">
                        <span>Duration:</span>
                        <input
                            type="number"
                            min="10"
                            max="3600"
                            value={duration}
                            onChange={(e) => {
                                const newDuration = Number(e.target.value)
                                setDuration(newDuration)
                                if (containerRef.current) {
                                    const containerWidth = containerRef.current.clientWidth
                                    const newZoom = Math.max(5, Math.min(200, containerWidth / newDuration))
                                    setZoom(newZoom)
                                }
                            }}
                            className="w-16 bg-transparent border-b border-muted-foreground/50 text-center focus:outline-none"
                        />
                        <span>s</span>
                    </div>
                    <span>|</span>
                    <span>Timeline Scale: {zoom}px/s</span>
                    <span>|</span>
                    <span>Time: {currentTime.toFixed(2)}s</span>
                </div>
                <div className="flex gap-2 items-center">
                </div>
            </div>

            {/* Main Timeline Scroll Area */}
            <ScrollArea className="flex-1 overflow-hidden relative">
                <div
                    className="relative min-w-full"
                    style={{ height: Math.max(0, totalTrackHeight) }}
                    ref={containerRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    {(() => {
                        const viewDuration = 300 // 5 minutes
                        const rulerHeight = 30
                        const contentWidth = viewDuration * zoom

                        return (
                            <div className="relative h-full" style={{ width: contentWidth }}>
                                {/* Sticky Ruler Header */}
                                <div className="sticky top-0 left-0 right-0 z-20 h-[30px] bg-background border-b shadow-sm">
                                    <svg
                                        width="100%"
                                        height={rulerHeight}
                                        className="block cursor-pointer"
                                        onMouseDown={(e) => {
                                            isDraggingPlayhead.current = true
                                            updatePlayheadPosition(e)
                                        }}
                                    >
                                        <Ruler activeDuration={duration} totalDuration={viewDuration} zoom={zoom} height={rulerHeight} />
                                    </svg>
                                </div>

                                {/* Tracks Container */}
                                <div className="relative" style={{ height: tracks.length * 50 }}>
                                    <svg
                                        ref={svgRef}
                                        className="w-full h-full block bg-muted/5 absolute top-0 left-0"
                                        style={{ width: `${contentWidth}px`, height: `${totalTrackHeight - 30}px` }}
                                        onMouseDown={(e) => {
                                            const target = e.target as Element;
                                            const isClip = target.closest('.group');
                                            if (!isClip) {
                                                isDraggingPlayhead.current = true
                                                updatePlayheadPosition(e)
                                                setSelectedClipId(null)
                                            }
                                        }}
                                    >
                                        <pattern id="grid" width={zoom} height="100" patternUnits="userSpaceOnUse">
                                            <path d={`M ${zoom} 0 L 0 0 0 100`} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
                                        </pattern>
                                        <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

                                        {/* Active Playback Area Shading */}
                                        <rect width={duration * zoom} height="100%" fill="hsl(var(--primary)/0.03)" pointerEvents="none" />

                                        {/* Playback End Marker */}
                                        <line
                                            x1={duration * zoom}
                                            y1={0}
                                            x2={duration * zoom}
                                            y2="100%"
                                            stroke="hsl(var(--primary)/0.4)"
                                            strokeWidth={2}
                                            strokeDasharray="4 2"
                                            pointerEvents="none"
                                        />

                                        <g>
                                            {tracks.map((track, i) => (
                                                <Track
                                                    key={track.id}
                                                    id={track.id}
                                                    type={track.type}
                                                    index={i}
                                                    clips={track.clips}
                                                    zoom={zoom}
                                                    selectedClipId={selectedClipId}
                                                    onClipDragStart={(e, clipId) => handleClipDragStart(e, clipId)}
                                                    onClipResizeStart={(e, clipId, direction) => handleClipResizeStart(e, clipId, direction)}
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                </div>

                                {/* Playhead Overlay - Absolute to span entire scrollable height but needs to respect sticky header offset if we want it to cover ruler too. 
                                    Actually, if we put it here, it scrolls with content. 
                                    If we want sticky playhead-TOP, we need complexity.
                                    For now, let's keep it simple: It overlays everything and scrolls with time. 
                                    But wait, if Ruler is sticky, Playhead needs to be visible ON TOP of ruler too.
                                    
                                    We can render Playhead twice or use a full-height overlay that ignores sticky.
                                    Actually, a simple approach: Playhead is absolute in the main container. 
                                    Use z-index > sticky header.
                                 */}
                                <div
                                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                                    style={{ left: currentTime * zoom }}
                                >
                                    {/* Playhead Line */}
                                    <div className="w-[1.5px] h-full bg-red-500 mx-auto relative">
                                        {/* Triangle Handle */}
                                        <div className="absolute -top-0 -left-[5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-500 pointer-events-auto cursor-ew-resize"
                                            onMouseDown={handlePlayheadDragStart}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
            </ScrollArea>
        </div>
    )
}
