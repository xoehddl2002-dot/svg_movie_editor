import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Image as ImageIcon, Film, Maximize2, Crop as MaskIcon, FlipHorizontal, FlipVertical, RotateCw, RotateCcw, MousePointer2, Square, Circle, Triangle, Star, Hexagon, Upload, Info, Monitor, Scan, ImagePlus, ZoomIn, ZoomOut } from "lucide-react"
import { Clip } from "@/features/editor/store/useStore"
import { cn } from "@/lib/utils"
import { getRectPath, getEllipsePath, getTrianglePath, getStarPath, getPolygonPath } from "@/features/editor/utils/shapeUtils"
import { transformPath, getBoundsFromPathD } from "@/utils/svg/pathUtils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"

interface MaskEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

type TransformMode = 'move' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | null;

export function MaskEditor({ clip, onUpdate, onClose }: MaskEditorProps) {

    // Transform state
    const [flipH, setFlipH] = useState(clip.flipH || false)
    const [flipV, setFlipV] = useState(clip.flipV || false)
    const [rotation, setRotation] = useState(clip.rotation || 0)
    const [rotationChanged, setRotationChanged] = useState(false)
    const [imageX, setImageX] = useState(clip.imageX || 0)
    const [imageY, setImageY] = useState(clip.imageY || 0)
    const [imageScale, setImageScale] = useState(clip.imageScale || 1)
    const [imageScaleY, setImageScaleY] = useState(clip.imageScaleY ?? (clip.imageScale || 1))

    // Helper to extract the raw <image> href from a data:image/svg+xml URI (stripping masks)
    const extractRawImageFromSVG = (src: string): string => {
        if (!src.startsWith('data:image/svg+xml')) return src;
        try {
            const svgStr = decodeURIComponent(src.split(',')[1] || '');
            const match = svgStr.match(/<image[^>]*href=["']([^"']+)["'][^>]*>/i) || 
                          svgStr.match(/<image[^>]*href=["']([^"']+)["'][^>]*\/>/i);
            if (match && match[1]) {
                // Return the raw extracted image (could be base64 png/jpeg or external URL)
                return match[1];
            }
        } catch (e) {
            console.warn("Failed to parse svg string", e);
        }
        return src;
    };

    // Resource state - extract raw image immediately if it's an SVG data URI
    const [resourceSrc, setResourceSrc] = useState(extractRawImageFromSVG(clip.src))

    // Internal helper to determine type from src
    const getMediaType = (src: string): 'video' | 'image' => {
        if (src.match(/\.(mp4|webm|mov|m4v)$/i) || src.startsWith('blob:video/')) return 'video';
        return 'image';
    }

    const [resourceType, setResourceType] = useState<'video' | 'image'>(getMediaType(clip.src))

    // Assets state for Unified Picker
    const [assets, setAssets] = useState<{ type: 'video' | 'image', src: string, thumbnail?: string }[]>([]);

    useEffect(() => {
        const loadAssets = async () => {
            try {
                const response = await fetch('/api/assets');
                if (!response.ok) throw new Error('Failed to fetch assets');
                const data = await response.json();

                const combinedAssets: { type: 'video' | 'image', src: string, thumbnail?: string }[] = [
                    ...(data.videos || []).map((v: any) => ({ type: 'video' as const, ...v })),
                    ...(data.images || []).map((i: string) => ({ type: 'image' as const, src: i }))
                ];
                setAssets(combinedAssets);
            } catch (error) {
                console.error("Failed to load assets in MaskEditor", error);
            }
        };
        loadAssets();
    }, []);


    // Update resource type if src changes - REMOVED to prevent overwriting type for Blob URLs
    // useEffect(() => {
    //     setResourceType(getMediaType(resourceSrc));
    // }, [resourceSrc]);

    const svgRef = useRef<SVGSVGElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [imageSvgBounds, setImageSvgBounds] = useState({ x: 0, y: 0, width: clip.width || 100, height: clip.height || 100 })
    const [activeComponentId, setActiveComponentId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<string>("resource")

    // Interaction state
    const [mode, setMode] = useState<TransformMode>(null)
    const startRef = useRef<{
        mouseX: number;
        mouseY: number;
        imageStartX: number;
        imageStartY: number;
        imageStartScale: number;
        imageStartScaleY: number;
        shapeStartX: number;
        shapeStartY: number;
        shapeStartWidth: number;
        shapeStartHeight: number;
        shapeStartD?: string;
        handle: TransformMode;
    } | null>(null);

    const [isResourceLoaded, setIsResourceLoaded] = useState(false);
    const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [zoom, setZoom] = useState(0.9);
    // 리소스가처음 로드된 것인지(기존 클립) vs 교체된 것인지 구분
    const isInitialLoad = useRef(true);

    // Local state to prevent premature saving on Cancel
    const [localClip, setLocalClip] = useState<Partial<Clip>>(clip);

    // Sync incoming changes from the store if the user modifies the clip in the timeline/preview while the editor is open
    useEffect(() => {
        setLocalClip(prev => {
            // Only update if something relevant actually changed to prevent infinite loops
            if (JSON.stringify(prev.templateData) !== JSON.stringify(clip.templateData) || prev.viewBox !== clip.viewBox || prev.width !== clip.width || prev.height !== clip.height) {
                return {
                    ...prev,
                    templateData: clip.templateData,
                    viewBox: clip.viewBox,
                    width: clip.width,
                    height: clip.height,
                };
            }
            return prev;
        });

        // Also sync the bounds if width/height changed from outside
        setImageSvgBounds(prev => {
            const newW = clip.width || 100;
            const newH = clip.height || 100;
            if (prev.width !== newW || prev.height !== newH) {
                return { x: 0, y: 0, width: newW, height: newH };
            }
            return prev;
        });
    }, [clip.templateData, clip.viewBox, clip.width, clip.height]);

    // Initial check: Ensure at least one shape exists (Wait for resource load)
    useEffect(() => {
        if (!isResourceLoaded) return;

        // If no template data exists, initialize with a full-size rect
        if (!localClip.templateData || Object.keys(localClip.templateData).length === 0) {
            const w = imageSvgBounds.width;
            const h = imageSvgBounds.height;
            const pathD = getRectPath(0, 0, w, h);
            const newData = {
                "shape-1": {
                    type: "path",
                    d: pathD,
                    fill: "white",
                    id: "shape-1",
                    "data-shape-type": "rect",
                    x: 0,
                    y: 0,
                    width: w,
                    height: h
                }
            };
            setLocalClip(prev => ({
                ...prev,
                templateData: newData,
                viewBox: `0 0 ${w} ${h}`
            }));
            setActiveComponentId("shape-1");
        } else if (localClip.templateData && !activeComponentId) {
            // Auto-select first shape
            const ids = Object.keys(localClip.templateData);
            if (ids.length > 0) {
                setActiveComponentId(ids[0]);
            }
        }
    }, [isResourceLoaded, imageSvgBounds, localClip.templateData]);

    // Load resource and set coordinate system based on resource dimensions
    useEffect(() => {
        setIsResourceLoaded(false);
        if (!resourceSrc) return;

        const applyDimensions = (natW: number, natH: number) => {
            let actW = natW;
            let actH = natH;

            setNaturalDimensions({ width: actW, height: actH });
            
            const isInitial = isInitialLoad.current;
            isInitialLoad.current = false;

            // In the new conceptual model, the MaskEditor's boundary (the previewOutput) 
            // is ALWAYS fixed to the clip's width and height from the timeline.
            // We do NOT resize the mask box based on the loaded image's natural size or SVG viewBox.
            const useW = localClip.width || 100;
            const useH = localClip.height || 100;

            setImageSvgBounds({ x: 0, y: 0, width: useW, height: useH });
            setIsResourceLoaded(true);

            if (isInitial && !localClip.viewBox) {
                setLocalClip(prev => ({
                    ...prev,
                    viewBox: `0 0 ${useW} ${useH}`
                }));
            }
        };

        if (resourceType === 'image') {
            const img = new Image();
            img.onload = () => applyDimensions(img.naturalWidth, img.naturalHeight);
            img.onerror = () => {
                 console.warn("Failed to load image resource:", resourceSrc);
                 setIsResourceLoaded(true); 
            };
            img.src = resourceSrc;
        } else if (resourceType === 'video') {
            const vid = document.createElement('video');
            vid.onloadedmetadata = () => applyDimensions(vid.videoWidth, vid.videoHeight);
            vid.onerror = () => {
                 console.warn("Failed to load video resource:", resourceSrc);
                 setIsResourceLoaded(true);
            }
            vid.src = resourceSrc;
        }
    }, [resourceSrc, resourceType]);

    const getSVGPoint = (e: React.MouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM()?.inverse());
    };

    // Removed old shape handleMouseDown
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!mode || !startRef.current) return;

            const isTouchEvent = 'touches' in e;
            const clientX = isTouchEvent ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = isTouchEvent ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

            const pt = getSVGPoint({ clientX, clientY } as any);
            const dx = pt.x - startRef.current.mouseX;
            const dy = pt.y - startRef.current.mouseY;

            if (activeTab === 'resource') {
                if (mode === 'move') {
                    setImageX(startRef.current.imageStartX + dx);
                    setImageY(startRef.current.imageStartY + dy);
                } else {
                    // Determine actual width/height of the unscaled image from imageSvgBounds & naturalDimensions
                    let w = imageSvgBounds.width;
                    let h = imageSvgBounds.height;
                    if (naturalDimensions.width > 0 && naturalDimensions.height > 0) {
                        const containerRatio = imageSvgBounds.width / imageSvgBounds.height;
                        const imageRatio = naturalDimensions.width / naturalDimensions.height;
                        if (containerRatio > imageRatio) h = imageSvgBounds.width / imageRatio;
                        else w = imageSvgBounds.height * imageRatio;
                    }

                    const signX = mode.includes('e') ? 1 : mode.includes('w') ? -1 : 0;
                    const signY = mode.includes('s') ? 1 : mode.includes('n') ? -1 : 0;
                    
                    // We calculate scale change based on how much the edge moved relative to the center origin.
                    // Because origin is center, a change of dx on the right edge means the total width changed by 2 * dx.
                    // newScale = newTotalWidth / baseWidth
                    
                    let sx = startRef.current.imageStartScale;
                    let sy = startRef.current.imageStartScaleY;

                    if (signX !== 0 && w > 0) {
                        sx = Math.max(0.01, sx + (dx * signX) / w);
                    }
                    if (signY !== 0 && h > 0) {
                        sy = Math.max(0.01, sy + (dy * signY) / h);
                    }

                    setImageScale(sx);
                    setImageScaleY(sy);

                    const diffW = w * sx - w * startRef.current.imageStartScale;
                    const diffH = h * sy - h * startRef.current.imageStartScaleY;
                    setImageX(startRef.current.imageStartX + (signX * diffW / 2));
                    setImageY(startRef.current.imageStartY + (signY * diffH / 2));
                }
            } else if (activeTab === 'mask' && activeComponentId) {
                const { shapeStartX, shapeStartY, shapeStartWidth, shapeStartHeight } = startRef.current;
                
                let newX = shapeStartX;
                let newY = shapeStartY;
                let newW = shapeStartWidth;
                let newH = shapeStartHeight;

                if (mode === 'move') {
                    newX += dx;
                    newY += dy;
                } else {
                    if (mode.includes('e')) newW += dx;
                    if (mode.includes('w')) { newX += dx; newW -= dx; }
                    if (mode.includes('s')) newH += dy;
                    if (mode.includes('n')) { newY += dy; newH -= dy; }
                }

                // Minimum dimensions
                newW = Math.max(10, newW);
                newH = Math.max(10, newH);

                setLocalClip(prev => {
                    const newData = { ...prev.templateData };
                    const current = newData[activeComponentId];
                    if (!current) return prev;

                    const shapeType = current['data-shape-type'] || 'rect';
                    let newD = current.d;
                    if (shapeType === 'rect') {
                        newD = getRectPath(newX, newY, newW, newH, current.rx || 0, current.ry || 0);
                    } else if (shapeType === 'circle') {
                        newD = getEllipsePath(newX, newY, newW, newH);
                    } else if (startRef.current?.shapeStartD) {
                        // For Triangles, Stars, Polygons, and custom Paths, deform the raw SVG path directly
                        // This preserves irregular polygons and complex imported paths
                        const sx = shapeStartWidth > 0 ? newW / shapeStartWidth : 1;
                        const sy = shapeStartHeight > 0 ? newH / shapeStartHeight : 1;
                        const tx = newX - shapeStartX * sx;
                        const ty = newY - shapeStartY * sy;
                        newD = transformPath(startRef.current.shapeStartD, tx, ty, sx, sy);
                    }

                    newData[activeComponentId] = { ...current, x: newX, y: newY, width: newW, height: newH, d: newD };
                    return { ...prev, templateData: newData };
                });
            }
        };

        const handleMouseUp = () => {
            setMode(null);
            startRef.current = null;
        };

        if (mode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('touchmove', handleMouseMove, { passive: false });
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [mode, activeTab, activeComponentId]);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, handle: TransformMode, shapeId?: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (handle === 'move') {
            if (activeTab === 'mask' && !shapeId && activeComponentId) {
                // Clicking outside deselected shapes is fine
                setActiveComponentId(null);
                return;
            }
        }

        if (shapeId && activeTab === 'mask') {
            setActiveComponentId(shapeId);
        }

        const isTouchEvent = 'touches' in e;
        const clientX = isTouchEvent ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = isTouchEvent ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

        const pt = getSVGPoint({ clientX, clientY } as any);

        let shapeX = 0, shapeY = 0, shapeW = 0, shapeH = 0;
        let shapeD = '';
        if (activeTab === 'mask' && (shapeId || activeComponentId)) {
            const targetId = shapeId || activeComponentId;
            const data = localClip.templateData?.[targetId!];
            if (data) {
                if (data.d) shapeD = data.d;
                // Prioritize derived bounds from D if available to prevent drift
                if (data.d) {
                    const bounds = getBoundsFromPathD(data.d);
                    if (bounds.width > 0) {
                        shapeX = bounds.x;
                        shapeY = bounds.y;
                        shapeW = bounds.width;
                        shapeH = bounds.height;
                    } else {
                        shapeX = data.x || 0;
                        shapeY = data.y || 0;
                        shapeW = data.width || 0;
                        shapeH = data.height || 0;
                    }
                } else {
                    shapeX = data.x || 0;
                    shapeY = data.y || 0;
                    shapeW = data.width || 0;
                    shapeH = data.height || 0;
                }
                if (!shapeId) setActiveComponentId(targetId);
            }
        }

        startRef.current = {
            mouseX: pt.x,
            mouseY: pt.y,
            imageStartX: imageX,
            imageStartY: imageY,
            imageStartScale: imageScale,
            imageStartScaleY: imageScaleY,
            shapeStartX: shapeX,
            shapeStartY: shapeY,
            shapeStartWidth: shapeW,
            shapeStartHeight: shapeH,
            shapeStartD: shapeD,
            handle
        };
        setMode(handle);
    };

    const renderHandles = (x: number, y: number, w: number, h: number, strokeColor: string) => {
        const handleSize = Math.max(8, imageSvgBounds.width / 50) / zoom;
        const hs = handleSize / 2;
        const unselectedStrokeWidth = Math.max(0.5, imageSvgBounds.width / 1000);

        const positions = [
            { pos: 'nw' as TransformMode, cx: x, cy: y, cursor: 'nwse-resize' },
            { pos: 'n' as TransformMode, cx: x + w / 2, cy: y, cursor: 'ns-resize' },
            { pos: 'ne' as TransformMode, cx: x + w, cy: y, cursor: 'nesw-resize' },
            { pos: 'e' as TransformMode, cx: x + w, cy: y + h / 2, cursor: 'ew-resize' },
            { pos: 'se' as TransformMode, cx: x + w, cy: y + h, cursor: 'nwse-resize' },
            { pos: 's' as TransformMode, cx: x + w / 2, cy: y + h, cursor: 'ns-resize' },
            { pos: 'sw' as TransformMode, cx: x, cy: y + h, cursor: 'nesw-resize' },
            { pos: 'w' as TransformMode, cx: x, cy: y + h / 2, cursor: 'ew-resize' },
        ];

        return (
            <g>
                <rect
                    x={x} y={y} width={w} height={h}
                    fill="transparent"
                    stroke={strokeColor}
                    strokeWidth={unselectedStrokeWidth * 4}
                    strokeDasharray="4,4"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                />
                {positions.map((p) => (
                    <rect
                        key={p.pos}
                        x={p.cx - hs}
                        y={p.cy - hs}
                        width={handleSize}
                        height={handleSize}
                        fill="white"
                        stroke={strokeColor}
                        strokeWidth={unselectedStrokeWidth * 4}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: p.cursor, pointerEvents: 'all' }}
                        onMouseDown={(e) => handleInteractionStart(e, p.pos)}
                        onTouchStart={(e) => handleInteractionStart(e, p.pos)}
                    />
                ))}
            </g>
        );
    };


    const handleSave = () => {
        const updates: Partial<Clip> = {
            ...localClip,
            flipH,
            flipV,
            src: resourceSrc,
            imageX,
            imageY,
            imageScale,
            imageScaleY
        };

        if (rotationChanged) {
            updates.rotation = rotation;
        }

        onUpdate(updates);
        onClose();
    };

    const rotateLeft = () => {
        setRotation(r => ((r - 90) % 360 + 360) % 360)
        setRotationChanged(true)
    }
    const rotateRight = () => {
        setRotation(r => (r + 90) % 360)
        setRotationChanged(true)
    }
    const toggleFlipH = () => setFlipH(f => !f)
    const toggleFlipV = () => setFlipV(f => !f)

    const addShape = (shapeType: 'rect' | 'circle' | 'triangle' | 'star' | 'polygon') => {
        const id = `shape-${Date.now()}`;

        const boxMin = Math.min(imageSvgBounds.width, imageSvgBounds.height);
        const w = Math.round(boxMin / 3);
        const h = Math.round(boxMin / 3);
        const x = (imageSvgBounds.width - w) / 2 + imageSvgBounds.x;
        const y = (imageSvgBounds.height - h) / 2 + imageSvgBounds.y;

        let d = '';
        if (shapeType === 'rect') d = getRectPath(x, y, w, h);
        else if (shapeType === 'circle') d = getEllipsePath(x, y, w, h);
        else if (shapeType === 'triangle') d = getTrianglePath(x, y, w, h);
        else if (shapeType === 'star') d = getStarPath(x, y, w, h);
        else if (shapeType === 'polygon') d = getPolygonPath(x, y, w, h, 5);

        // Single shape only — replace all existing shapes
        const newData = {
            [id]: {
                type: 'path',
                id,
                x, y, width: w, height: h,
                d,
                fill: 'white',
                'data-shape-type': shapeType,
                sides: shapeType === 'polygon' ? 5 : undefined
            }
        };

        setLocalClip(prev => ({
            ...prev,
            templateData: newData,
            viewBox: `${imageSvgBounds.x} ${imageSvgBounds.y} ${imageSvgBounds.width} ${imageSvgBounds.height}`
        }));
        setActiveComponentId(id);
    };



    // Removed renderHandles since mask shape size is fixed and original image is dragged instead

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setResourceSrc(url);

        if (file.type.startsWith('video')) {
            setResourceType('video');
        } else if (file.type.startsWith('image')) {
            setResourceType('image');
        }
    }

    return (
        <>
            <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center gap-2 space-y-0 bg-white dark:bg-zinc-950">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                    {resourceType === 'video' ? <Film className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg">Edit {resourceType === 'video' ? 'Video' : 'Image'} & Mask: {clip.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground uppercase">{resourceType} • ID: {clip.id.slice(0, 8)}</p>
                </div>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {/* Left: Preview Area */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 flex items-center justify-center p-12 border-r overflow-hidden relative group">
                    <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none" />

                    <div
                        className="relative shadow-2xl rounded-sm ring-1 ring-border bg-black/50 flex items-center justify-center transition-transform duration-200"
                        style={{
                            aspectRatio: imageSvgBounds.height ? `${imageSvgBounds.width} / ${imageSvgBounds.height}` : 'auto',
                            width: '100%',
                            maxHeight: '100%',
                            // A CSS trick to make aspect ratio fit inside a flex container without breaking its bounds
                            objectFit: 'contain'
                        }}
                    >
                        <svg
                            ref={svgRef}
                            viewBox={`${imageSvgBounds.x + (imageSvgBounds.width * (1 - 1/zoom)) / 2} ${imageSvgBounds.y + (imageSvgBounds.height * (1 - 1/zoom)) / 2} ${imageSvgBounds.width / zoom} ${imageSvgBounds.height / zoom}`}
                            className="absolute inset-0 w-full h-full overflow-hidden"
                            preserveAspectRatio="xMidYMid meet"
                            onMouseDown={(e) => {
                                if (activeTab === 'mask') {
                                    handleInteractionStart(e, 'move');
                                }
                            }}
                            onTouchStart={(e) => {
                                if (activeTab === 'mask') {
                                    handleInteractionStart(e, 'move');
                                }
                            }}
                            style={{ cursor: mode === 'move' ? 'grabbing' : 'default' }}
                        >
                            {/* 1. Background (Image or Video) */}
                            {(() => {
                                // Calculate actual dimensions to mimic object-fit: cover but with exact width/height/x/y
                                let w = imageSvgBounds.width;
                                let h = imageSvgBounds.height;
                                let objX = imageSvgBounds.x;
                                let objY = imageSvgBounds.y;

                                if (naturalDimensions.width > 0 && naturalDimensions.height > 0) {
                                    const containerRatio = imageSvgBounds.width / imageSvgBounds.height;
                                    const imageRatio = naturalDimensions.width / naturalDimensions.height;

                                    if (containerRatio > imageRatio) {
                                        // Container is wider than image (relative to height) -> fit to width
                                        w = imageSvgBounds.width;
                                        h = imageSvgBounds.width / imageRatio;
                                        objY = imageSvgBounds.y - (h - imageSvgBounds.height) / 2;
                                    } else {
                                        // Container is taller than image (relative to width) -> fit to height
                                        h = imageSvgBounds.height;
                                        w = imageSvgBounds.height * imageRatio;
                                        objX = imageSvgBounds.x - (w - imageSvgBounds.width) / 2;
                                    }
                                }

                                return (
                                    <g style={{
                                        transform: `translate(${imageX}px, ${imageY}px) scale(${imageScale * (flipH ? -1 : 1)}, ${imageScaleY * (flipV ? -1 : 1)}) rotate(${rotation}deg)`,
                                        transformOrigin: 'center',
                                        transition: mode ? 'none' : 'transform 0.3s ease-in-out',
                                        opacity: 1
                                    }}>
                                        {resourceType === 'video' ? (
                                            <foreignObject
                                                x={objX}
                                                y={objY}
                                                width={w}
                                                height={h}
                                            >
                                                <video
                                                    ref={videoRef}
                                                    src={resourceSrc}
                                                    className="w-full h-full object-cover"
                                                    controls={false}
                                                    muted
                                                    autoPlay
                                                    loop
                                                    onMouseDown={(e) => {
                                                        if (activeTab === 'resource') {
                                                            handleInteractionStart(e, 'move');
                                                        }
                                                    }}
                                                    onTouchStart={(e) => {
                                                        if (activeTab === 'resource') {
                                                            handleInteractionStart(e, 'move');
                                                        }
                                                    }}
                                                    style={{ cursor: activeTab === 'resource' ? (mode ? 'grabbing' : 'grab') : 'default' }}
                                                />
                                            </foreignObject>
                                        ) : (
                                            <image
                                                href={resourceSrc}
                                                x={objX}
                                                y={objY}
                                                width={w}
                                                height={h}
                                                preserveAspectRatio="none"
                                                onMouseDown={(e) => {
                                                    if (activeTab === 'resource') {
                                                        handleInteractionStart(e, 'move');
                                                    }
                                                }}
                                                onTouchStart={(e) => {
                                                    if (activeTab === 'resource') {
                                                        handleInteractionStart(e, 'move');
                                                    }
                                                }}
                                                style={{ cursor: activeTab === 'resource' ? (mode ? 'grabbing' : 'grab') : 'default' }}
                                            />
                                        )}
                                        {activeTab === 'resource' && renderHandles(objX, objY, w, h, "#3b82f6")}
                                    </g>
                                );
                            })()}

                            {/* 2. Mask Shapes Overlay */}
                            <g style={{ pointerEvents: 'none' }}>
                                {localClip.templateData && Object.entries(localClip.templateData).map(([id, data]: [string, any]) => {
                                    const fill = 'rgba(0,0,0,0.6)';

                                    const unselectedStrokeWidth = Math.max(0.5, imageSvgBounds.width / 1000);

                                    return (
                                        <g key={id}>
                                            <mask id={`mask-${id}`}>
                                                <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
                                                {data.d && (
                                                    <path d={data.d} fill="black" />
                                                )}
                                            </mask>
                                            <rect
                                                x="-10000"
                                                y="-10000"
                                                width="20000"
                                                height="20000"
                                                fill={activeTab === 'resource' ? 'transparent' : fill}
                                                mask={activeTab === 'resource' ? undefined : `url(#mask-${id})`}
                                            />
                                            {/* Original path border for interaction */}
                                            {data.d && (
                                                <path
                                                    d={data.d}
                                                    fill={activeTab === 'mask' ? "transparent" : "none"}
                                                    stroke="#ff0000"
                                                    strokeWidth={unselectedStrokeWidth * 2}
                                                    vectorEffect="non-scaling-stroke"
                                                    style={{ 
                                                        pointerEvents: activeTab === 'mask' ? 'all' : 'none', 
                                                        cursor: activeTab === 'mask' ? (mode ? 'grabbing' : 'grab') : 'default' 
                                                    }}
                                                    onMouseDown={(e) => handleInteractionStart(e, 'move', id)}
                                                    onTouchStart={(e) => handleInteractionStart(e, 'move', id)}
                                                />
                                            )}
                                            {/* Render Handles for Mask Object */}
                                            {activeTab === 'mask' && activeComponentId === id && (() => {
                                                let bx = data.x || 0;
                                                let by = data.y || 0;
                                                let bw = data.width || 0;
                                                let bh = data.height || 0;

                                                if (data.d) {
                                                    const bounds = getBoundsFromPathD(data.d);
                                                    if (bounds.width > 0) {
                                                        bx = bounds.x;
                                                        by = bounds.y;
                                                        bw = bounds.width;
                                                        bh = bounds.height;
                                                    }
                                                }
                                                return renderHandles(bx, by, bw, bh, "#ef4444");
                                            })()}
                                        </g>
                                    );
                                })}
                            </g>
                            
                            {/* 3. Preview Output Border */}
                            <rect 
                                x={imageSvgBounds.x} 
                                y={imageSvgBounds.y} 
                                width={imageSvgBounds.width} 
                                height={imageSvgBounds.height} 
                                fill="none" 
                                stroke="#00ffff" 
                                strokeWidth={Math.max(2, imageSvgBounds.width / 500)} 
                                strokeDasharray="5,5"
                                style={{ pointerEvents: 'none' }}
                            />
                        </svg>
                    </div>

                    {/* Zoom Controls */}
                    <div className="hidden absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/90 backdrop-blur-md p-1.5 rounded-full border shadow-md">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} title="Zoom Out">
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <div className="text-[11px] font-mono font-medium w-12 text-center select-none text-foreground/80">
                            {Math.round(zoom * 100)}%
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(z => Math.min(5, z + 0.1))} title="Zoom In">
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full ml-1" onClick={() => setZoom(0.9)} title="Fit to Screen (90%)" disabled={zoom === 0.9}>
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-[400px] shrink-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden border-l">
                    <div className="px-4 pt-4 pb-2 border-b bg-muted/5 shrink-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                            <Monitor className="w-4 h-4" />
                            Dimensions Info
                        </div>
                        <div className="flex flex-col gap-2 relative">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 border border-cyan-600/20 rounded-md text-[11px] whitespace-nowrap">
                                <span className="font-medium flex items-center gap-1"><Monitor className="w-3.5 h-3.5" />Preview Output:</span>
                                <span className="font-mono font-semibold tabular-nums">
                                    {Math.round(localClip.width || 100)} × {Math.round(localClip.height || 100)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-1.5 bg-red-600/10 text-red-700 dark:text-red-300 border border-red-600/20 rounded-md text-[11px] whitespace-nowrap">
                                <span className="font-medium flex items-center gap-1"><Hexagon className="w-3.5 h-3.5" />Shape Bound:</span>
                                <span className="font-mono font-semibold tabular-nums">
                                    {(() => {
                                        let sw = 0, sh = 0;
                                        if (localClip.templateData) {
                                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                            Object.values(localClip.templateData).forEach((d: any) => {
                                                if (d.d) {
                                                    const bounds = getBoundsFromPathD(d.d);
                                                    if (bounds.width > 0 && bounds.height > 0) {
                                                        minX = Math.min(minX, bounds.x);
                                                        minY = Math.min(minY, bounds.y);
                                                        maxX = Math.max(maxX, bounds.x + bounds.width);
                                                        maxY = Math.max(maxY, bounds.y + bounds.height);
                                                    }
                                                }
                                            });
                                            if (minX !== Infinity) { sw = maxX - minX; sh = maxY - minY; }
                                        }
                                        return sw > 0 ? `${Math.round(sw)} × ${Math.round(sh)}` : '0 × 0';
                                    })()}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 px-3 py-1.5 bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-600/20 rounded-md text-[11px] whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" />Native File Size:</span>
                                    <span className="font-mono font-semibold tabular-nums">
                                        {naturalDimensions.width} × {naturalDimensions.height}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-blue-600/10 pt-1 mt-0.5">
                                    <span className="font-medium flex items-center gap-1 opacity-80"><Monitor className="w-3 h-3 ml-0.5" />Modal Viewport:</span>
                                    <span className="font-mono font-semibold tabular-nums opacity-90">
                                        {(() => {
                                            let vw = imageSvgBounds.width;
                                            let vh = imageSvgBounds.height;
                                            if (naturalDimensions.width > 0 && naturalDimensions.height > 0) {
                                                const containerRatio = imageSvgBounds.width / imageSvgBounds.height;
                                                const imageRatio = naturalDimensions.width / naturalDimensions.height;
                                                if (containerRatio > imageRatio) {
                                                    vw = imageSvgBounds.width;
                                                    vh = imageSvgBounds.width / imageRatio;
                                                } else {
                                                    vh = imageSvgBounds.height;
                                                    vw = imageSvgBounds.height * imageRatio;
                                                }
                                            }
                                            return `${Math.round(vw)} × ${Math.round(vh)}`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 pt-4 shrink-0">
                            <TabsList className="w-full grid grid-cols-2">
                                <TabsTrigger value="resource">Resource</TabsTrigger>
                                <TabsTrigger value="mask" disabled={!localClip.templateData}>Mask Shapes</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                             <TabsContent value="resource" className="absolute inset-0 mt-0">
                                <ScrollArea className="h-full w-full" type="always">
                                    <div className="flex flex-col p-4 gap-4">
                                        <div className="space-y-4 shrink-0">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                                <Upload className="w-4 h-4" />
                                                Source & Transform
                                            </div>
                                        <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                            {/* File Upload / Swap */}
                                            <div className="space-y-2">
                                                <Label className="text-xs">Current Source</Label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 p-2 bg-background border rounded text-xs font-mono truncate">
                                                        {resourceSrc.slice(0, 30)}...
                                                    </div>
                                                    <Button size="icon" variant="outline" className="shrink-0 relative">
                                                        <Upload className="w-4 h-4" />
                                                        <input
                                                            type="file"
                                                            accept="image/*,video/*"
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            onChange={handleFileChange}
                                                        />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="h-px bg-border my-2" />

                                            {/* Transform Controls */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs">Rotation</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            value={Math.round(rotation)}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                setRotation(val);
                                                                setRotationChanged(true);
                                                            }}
                                                            className="h-6 w-16 text-xs text-right p-1"
                                                        />
                                                        <span className="text-xs text-muted-foreground">°</span>
                                                    </div>
                                                </div>

                                                <Slider
                                                    value={[rotation]}
                                                    min={0}
                                                    max={360}
                                                    step={1}
                                                    onValueChange={([v]) => {
                                                        setRotation(v);
                                                        setRotationChanged(true);
                                                    }}
                                                />

                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={rotateLeft}>
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        -90°
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={rotateRight}>
                                                        <RotateCw className="w-4 h-4 mr-2" />
                                                        +90°
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs">Flip</Label>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant={flipH ? "secondary" : "outline"}
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={toggleFlipH}
                                                    >
                                                        <FlipHorizontal className="w-4 h-4 mr-2" />
                                                        Horizontal
                                                    </Button>
                                                    <Button
                                                        variant={flipV ? "secondary" : "outline"}
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={toggleFlipV}
                                                    >
                                                        <FlipVertical className="w-4 h-4 mr-2" />
                                                        Vertical
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                            <ImageIcon className="w-4 h-4" />
                                            Asset Library
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-2 border rounded-md bg-muted/10">
                                            {assets.map((asset, i) => (
                                                <Card
                                                    key={i}
                                                    className="overflow-hidden cursor-pointer hover:border-primary group relative transition-all active:scale-95"
                                                    onClick={() => {
                                                        const rawSrc = extractRawImageFromSVG(asset.src);
                                                        setResourceSrc(rawSrc);
                                                        setResourceType(asset.type);
                                                    }}
                                                >
                                                    <CardContent className="p-0 aspect-video relative bg-black/5 flex items-center justify-center">
                                                        {asset.type === 'video' ? (
                                                            asset.thumbnail ? (
                                                                <img src={asset.thumbnail} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <video src={asset.src} className="w-full h-full object-cover" />
                                                            )
                                                        ) : (
                                                            <img src={asset.src} className="w-full h-full object-cover" />
                                                        )}
                                                        
                                                        <div className={cn(
                                                            "absolute inset-0 transition-opacity flex items-center justify-center text-white text-[10px] font-bold bg-black/40",
                                                            resourceSrc === asset.src ? "opacity-100 ring-4 ring-primary ring-inset" : "opacity-0 group-hover:opacity-100"
                                                        )}>
                                                            {resourceSrc === asset.src ? "SELECTED" : "USE THIS"}
                                                        </div>
                                                        
                                                        {asset.type === 'video' && (
                                                            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-white text-[8px] font-bold flex items-center gap-1">
                                                                <Film className="w-2 h-2" /> VID
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="mask" className="mt-0 h-full overflow-y-auto custom-scrollbar p-4">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Maximize2 className="w-4 h-4" />
                                        Shape Geometry
                                    </div>

                                    {/* Toolbar for Shapes moved here */}
                                    <div className="bg-muted/30 p-2 rounded-lg border flex gap-2 justify-center">
                                        <Button variant="outline" size="icon" onClick={() => addShape('rect')} title="Rectangle">
                                            <Square className="w-5 h-5" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => addShape('circle')} title="Circle/Ellipse">
                                            <Circle className="w-5 h-5" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => addShape('triangle')} title="Triangle">
                                            <Triangle className="w-5 h-5" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => addShape('star')} title="Star">
                                            <Star className="w-5 h-5" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => addShape('polygon')} title="Polygon">
                                            <Hexagon className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    <div className="space-y-4">


                                        {localClip.templateData && Object.entries(localClip.templateData).map(([id, data]: [string, any]) => (
                                            <div key={id} className={cn(
                                                "p-4 rounded-lg border space-y-4 transition-colors",
                                                activeComponentId === id ? "bg-primary/5 border-primary/20" : "bg-muted/30 hover:bg-muted/50"
                                            )}>
                                                <div className="flex items-center justify-between border-b pb-2 mb-2" onClick={() => setActiveComponentId(id)}>
                                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-50">{id}</span>
                                                    <Button
                                                        variant={activeComponentId === id ? "secondary" : "ghost"}
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2 gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveComponentId(activeComponentId === id ? null : id);
                                                        }}
                                                    >
                                                        <MousePointer2 className="w-3 h-3" />
                                                        {activeComponentId === id ? "Selected" : "Select"}
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {data.sides !== undefined && (
                                                        <div className="space-y-1 col-span-2">
                                                            <Label className="text-[10px] uppercase font-bold opacity-70">Sides</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Slider
                                                                    value={[data.sides]}
                                                                    min={3}
                                                                    max={20}
                                                                    step={1}
                                                                    onValueChange={([val]) => {
                                                                        const newData = { ...localClip.templateData };
                                                                        const current = newData[id];
                                                                        const newProps = { ...current, sides: val };
                                                                        const { x, y, width, height } = newProps;
                                                                        
                                                                        const newD = getPolygonPath(x, y, width, height, val);
                                                                        newData[id] = { ...newProps, d: newD };
                                                                        setLocalClip(prev => ({ ...prev, templateData: newData }));
                                                                    }}
                                                                    className="flex-1"
                                                                />
                                                                <span className="w-8 text-xs font-mono text-right">{data.sides}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {['x', 'y', 'width', 'height'].map(prop => (
                                                        data[prop] !== undefined && (
                                                            <div key={prop} className="space-y-1">
                                                                <Label className="text-[10px] uppercase font-bold opacity-70">{prop}</Label>
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-xs font-mono"
                                                                    value={data[prop]}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                        const val = Number(e.target.value);
                                                                        const newData = { ...localClip.templateData };
                                                                        const current = newData[id];
                                                                        const newProps = { ...current, [prop]: val };

                                                                        const shapeType = current['data-shape-type'] || 'rect';
                                                                        let newD = current.d;
                                                                        const { x, y, width, height } = newProps;
                                                                        if (shapeType === 'rect') {
                                                                            newD = getRectPath(x, y, width, height, current.rx || 0, current.ry || 0);
                                                                        } else if (shapeType === 'circle') {
                                                                            newD = getEllipsePath(x, y, width, height);
                                                                        } else if (current.d) {
                                                                            const oldW = current.width || 1;
                                                                            const oldH = current.height || 1;
                                                                            const sx = width / oldW;
                                                                            const sy = height / oldH;
                                                                            const tx = x - (current.x || 0) * sx;
                                                                            const ty = y - (current.y || 0) * sy;
                                                                            newD = transformPath(current.d, tx, ty, sx, sy);
                                                                        }
                                                                        
                                                                        newData[id] = { ...newProps, d: newD };
                                                                        setLocalClip(prev => ({ ...prev, templateData: newData }));
                                                                    }}
                                                                />
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0 bg-white dark:bg-zinc-950">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Save Changes</Button>
            </DialogFooter>
        </>
    )
}
