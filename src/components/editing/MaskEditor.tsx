import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Image as ImageIcon, Film, Maximize2, Crop as MaskIcon, FlipHorizontal, FlipVertical, RotateCw, RotateCcw, MousePointer2, Square, Circle, Triangle, Star, Upload } from "lucide-react"
import { Clip } from "@/features/editor/store/useStore"
import { cn } from "@/lib/utils"
import { getRectPath, getEllipsePath, getTrianglePath, getStarPath } from "@/features/editor/utils/shapeUtils"

interface MaskEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

type TransformMode = 'move' | 'rotate' | 'scale-n' | 'scale-s' | 'scale-e' | 'scale-w' | 'scale-nw' | 'scale-ne' | 'scale-sw' | 'scale-se' | null;

export function MaskEditor({ clip, onUpdate, onClose }: MaskEditorProps) {

    // Transform state
    const [flipH, setFlipH] = useState(clip.flipH || false)
    const [flipV, setFlipV] = useState(clip.flipV || false)
    const [rotation, setRotation] = useState(clip.rotation || 0)
    const [rotationChanged, setRotationChanged] = useState(false)

    // Resource state
    const [resourceSrc, setResourceSrc] = useState(clip.src)
    const [resourceType, setResourceType] = useState(clip.type)

    const svgRef = useRef<SVGSVGElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [imageSvgBounds, setImageSvgBounds] = useState({ x: 0, y: 0, width: 100, height: 100 })
    const [activeComponentId, setActiveComponentId] = useState<string | null>(null)

    // Interaction state
    const [mode, setMode] = useState<TransformMode>(null)
    const startRef = useRef<{
        mouseX: number;
        mouseY: number;
        shapeX: number;
        shapeY: number;
        shapeW: number;
        shapeH: number;
        data?: any;
    } | null>(null);

    const [isResourceLoaded, setIsResourceLoaded] = useState(false);

    // Load resource natural dimensions
    useEffect(() => {
        setIsResourceLoaded(false);
        if (!resourceSrc) return;

        if (resourceType === 'image') {
            const img = new Image();
            img.onload = () => {
                const w = img.naturalWidth || 100;
                const h = img.naturalHeight || 100;
                setImageSvgBounds({ x: 0, y: 0, width: w, height: h });
                setIsResourceLoaded(true);

                // Only update viewBox if it's missing or if we are initializing a new clip (no template data yet)
                if (!clip.viewBox || (!clip.templateData || Object.keys(clip.templateData).length === 0)) {
                    onUpdate({ viewBox: `0 0 ${w} ${h}` });
                }
            };
            img.src = resourceSrc;
        } else if (resourceType === 'video') {
            const vid = document.createElement('video');
            vid.onloadedmetadata = () => {
                const w = vid.videoWidth || 100;
                const h = vid.videoHeight || 100;
                setImageSvgBounds({ x: 0, y: 0, width: w, height: h });
                setIsResourceLoaded(true);

                if (!clip.viewBox || (!clip.templateData || Object.keys(clip.templateData).length === 0)) {
                    onUpdate({ viewBox: `0 0 ${w} ${h}` });
                }
            };
            vid.src = resourceSrc;
        }
    }, [resourceSrc, resourceType]);

    // Initial check: Ensure at least one shape exists (Wait for resource load)
    useEffect(() => {
        if (!isResourceLoaded) return;

        if (!clip.templateData || Object.keys(clip.templateData).length === 0) {
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
            onUpdate({
                templateData: newData,
                viewBox: `0 0 ${w} ${h}`
            });
            setActiveComponentId("shape-1");
        } else if (clip.templateData && !activeComponentId) {
            // Auto-select first shape
            const ids = Object.keys(clip.templateData);
            if (ids.length > 0) {
                setActiveComponentId(ids[0]);
            }
        }
    }, [isResourceLoaded, imageSvgBounds, clip.templateData]);

    const getSVGPoint = (e: React.MouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM()?.inverse());
    };

    const handleMouseDown = (e: React.MouseEvent, m: TransformMode, id: string) => {
        e.stopPropagation();
        e.preventDefault();

        if (!clip.templateData || !clip.templateData[id]) return;

        setActiveComponentId(id);
        const data = clip.templateData[id];
        const pt = getSVGPoint(e);

        let sx = data.x || 0;
        let sy = data.y || 0;
        let sw = data.width || 100;
        let sh = data.height || 100;

        startRef.current = {
            mouseX: pt.x,
            mouseY: pt.y,
            shapeX: sx,
            shapeY: sy,
            shapeW: sw,
            shapeH: sh,
            data: data
        };
        setMode(m);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!mode || !startRef.current || !activeComponentId || !clip.templateData) return;

            const pt = getSVGPoint(e);
            const start = startRef.current;
            const dx = pt.x - start.mouseX;
            const dy = pt.y - start.mouseY;

            let newX = start.shapeX;
            let newY = start.shapeY;
            let newW = start.shapeW;
            let newH = start.shapeH;

            if (mode === 'move') {
                newX = start.shapeX + dx;
                newY = start.shapeY + dy;
            } else if (mode.startsWith('scale')) {
                if (mode.includes('e')) newW = Math.max(1, start.shapeW + dx);
                if (mode.includes('s')) newH = Math.max(1, start.shapeH + dy);
                if (mode.includes('w')) {
                    const delta = Math.min(dx, start.shapeW - 1);
                    newX = start.shapeX + delta;
                    newW = start.shapeW - delta;
                }
                if (mode.includes('n')) {
                    const delta = Math.min(dy, start.shapeH - 1);
                    newY = start.shapeY + delta;
                    newH = start.shapeH - delta;
                }
            }

            // Update templateData
            const newData = { ...clip.templateData };
            const currentItem = newData[activeComponentId];
            const shapeType = currentItem['data-shape-type'] || 'rect';

            let newD = currentItem.d;
            if (shapeType === 'rect') {
                newD = getRectPath(newX, newY, newW, newH, currentItem.rx || 0, currentItem.ry || 0);
            } else if (shapeType === 'circle' || shapeType === 'ellipse') {
                newD = getEllipsePath(newX, newY, newW, newH);
            } else if (shapeType === 'triangle') {
                newD = getTrianglePath(newX, newY, newW, newH);
            } else if (shapeType === 'star') {
                newD = getStarPath(newX, newY, newW, newH);
            }

            newData[activeComponentId] = {
                ...currentItem,
                x: Math.round(newX * 100) / 100,
                y: Math.round(newY * 100) / 100,
                width: Math.round(newW * 100) / 100,
                height: Math.round(newH * 100) / 100,
                d: newD
            };

            onUpdate({ templateData: newData });
        };

        const handleMouseUp = () => {
            setMode(null);
            startRef.current = null;
        };

        if (mode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [mode, activeComponentId, clip.templateData, onUpdate]);


    const handleSave = () => {
        const updates: Partial<Clip> = {
            flipH,
            flipV,
            src: resourceSrc,
            type: resourceType as any
        }

        if (rotationChanged) {
            updates.rotation = rotation;
        }

        onUpdate(updates)
        onClose()
    }

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

    const addShape = (shapeType: 'rect' | 'circle' | 'triangle' | 'star') => {
        const id = `shape-${Date.now()}`;

        const boxMin = Math.min(imageSvgBounds.width, imageSvgBounds.height);
        const w = Math.round(boxMin / 3);
        const h = Math.round(boxMin / 3);
        const x = (imageSvgBounds.width - w) / 2 + imageSvgBounds.x;
        const y = (imageSvgBounds.height - h) / 2 + imageSvgBounds.y;

        let currentData = { ...clip.templateData };
        // Clean default shape logic
        const keys = Object.keys(currentData);
        if (keys.length === 1) {
            const firstShape = currentData[keys[0]];
            const isFullSize = Math.abs(firstShape.width - imageSvgBounds.width) < 1 && Math.abs(firstShape.height - imageSvgBounds.height) < 1;

            if (firstShape['data-shape-type'] === 'rect' && isFullSize) {
                delete currentData[keys[0]];
            }
        }

        let d = '';
        if (shapeType === 'rect') d = getRectPath(x, y, w, h);
        else if (shapeType === 'circle') d = getEllipsePath(x, y, w, h);
        else if (shapeType === 'triangle') d = getTrianglePath(x, y, w, h);
        else if (shapeType === 'star') d = getStarPath(x, y, w, h);

        const newData = {
            ...currentData,
            [id]: {
                type: 'path',
                id,
                x, y, width: w, height: h,
                d,
                fill: 'white',
                'data-shape-type': shapeType
            }
        };

        onUpdate({
            templateData: newData,
            viewBox: `${imageSvgBounds.x} ${imageSvgBounds.y} ${imageSvgBounds.width} ${imageSvgBounds.height}`
        });
        setActiveComponentId(id);
    };

    const removeActiveShape = () => {
        if (!activeComponentId || !clip.templateData) return;

        const ids = Object.keys(clip.templateData);
        if (ids.length <= 1) {
            alert("Cannot remove the last mask shape.");
            return;
        }

        const newData = { ...clip.templateData };
        delete newData[activeComponentId];
        onUpdate({ templateData: newData });
        setActiveComponentId(null);
    }

    const renderHandles = (id: string, x: number, y: number, w: number, h: number) => {
        const handleSize = Math.max(imageSvgBounds.width / 50, 4);
        const half = handleSize / 2;

        const ControlRect = ({ cx, cy, m, cursor }: { cx: number, cy: number, m: TransformMode, cursor: string }) => (
            <rect
                x={cx - half} y={cy - half} width={handleSize} height={handleSize}
                fill="white" stroke="#00d9ff" strokeWidth={1}
                style={{ cursor, pointerEvents: 'auto' }}
                onMouseDown={(e) => handleMouseDown(e, m, id)}
            />
        );

        return (
            <g>
                <rect x={x} y={y} width={w} height={h} fill="none" stroke="#00d9ff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                <ControlRect cx={x} cy={y} m="scale-nw" cursor="nwse-resize" />
                <ControlRect cx={x + w} cy={y} m="scale-ne" cursor="nesw-resize" />
                <ControlRect cx={x} cy={y + h} m="scale-sw" cursor="nesw-resize" />
                <ControlRect cx={x + w} cy={y + h} m="scale-se" cursor="nwse-resize" />
                <ControlRect cx={x + w / 2} cy={y} m="scale-n" cursor="ns-resize" />
                <ControlRect cx={x + w / 2} cy={y + h} m="scale-s" cursor="ns-resize" />
                <ControlRect cx={x} cy={y + h / 2} m="scale-w" cursor="ew-resize" />
                <ControlRect cx={x + w} cy={y + h / 2} m="scale-e" cursor="ew-resize" />
            </g>
        );
    };

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
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 flex items-center justify-center p-8 border-r overflow-hidden relative group">
                    <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none" />

                    <div
                        className="relative shadow-2xl rounded-sm ring-1 ring-border bg-black/50 max-w-full max-h-full overflow-hidden flex items-center justify-center"
                        style={{ aspectRatio: `${imageSvgBounds.width} / ${imageSvgBounds.height}` }}
                    >
                        <svg
                            ref={svgRef}
                            viewBox={`${imageSvgBounds.x} ${imageSvgBounds.y} ${imageSvgBounds.width} ${imageSvgBounds.height}`}
                            className="w-full h-full"
                            preserveAspectRatio="none"
                        >
                            {/* 1. Background (Image or Video) */}
                            <g style={{
                                transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                transformOrigin: 'center',
                                transition: 'transform 0.3s ease-in-out',
                                opacity: 0.7
                            }}>
                                {resourceType === 'video' ? (
                                    <foreignObject
                                        x={imageSvgBounds.x}
                                        y={imageSvgBounds.y}
                                        width={imageSvgBounds.width}
                                        height={imageSvgBounds.height}
                                    >
                                        <video
                                            ref={videoRef}
                                            src={resourceSrc}
                                            className="w-full h-full object-fill"
                                            controls={false}
                                            muted
                                            autoPlay
                                            loop
                                        />
                                    </foreignObject>
                                ) : (
                                    <image
                                        href={resourceSrc}
                                        x={imageSvgBounds.x}
                                        y={imageSvgBounds.y}
                                        width={imageSvgBounds.width}
                                        height={imageSvgBounds.height}
                                    />
                                )}
                            </g>

                            {/* 2. Mask Shapes Overlay */}
                            <g style={{
                                transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                transformOrigin: 'center',
                            }}>
                                {clip.templateData && Object.entries(clip.templateData).map(([id, data]: [string, any]) => {
                                    const isActive = id === activeComponentId;
                                    const bx = data.x || 0;
                                    const by = data.y || 0;
                                    const bw = data.width || 0;
                                    const bh = data.height || 0;

                                    const commonProps = {
                                        key: id,
                                        fill: isActive ? "rgba(255, 0, 0, 0.3)" : "rgba(0, 0, 255, 0.2)",
                                        stroke: isActive ? "red" : "blue",
                                        strokeWidth: isActive ? 1 : 0.5,
                                        vectorEffect: "non-scaling-stroke" as any,
                                        style: { cursor: 'move', pointerEvents: 'auto' } as React.CSSProperties
                                    };

                                    const mouseDownHandler = (e: React.MouseEvent) => handleMouseDown(e, 'move', id);

                                    return (
                                        <g key={id}>
                                            {data.d && (
                                                <path d={data.d} {...commonProps} onMouseDown={mouseDownHandler} />
                                            )}
                                            {isActive && renderHandles(id, bx, by, bw, bh)}
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                    </div>

                    {/* Toolbar for Shapes */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-lg border flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => addShape('rect')} title="Rectangle">
                            <Square className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => addShape('circle')} title="Circle/Ellipse">
                            <Circle className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => addShape('triangle')} title="Triangle">
                            <Triangle className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => addShape('star')} title="Star">
                            <Star className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-[400px] shrink-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden border-l">
                    <Tabs defaultValue="resource" className="flex-1 flex flex-col">
                        <div className="px-4 pt-4 shrink-0">
                            <TabsList className="w-full grid grid-cols-2">
                                <TabsTrigger value="resource">Resource</TabsTrigger>
                                <TabsTrigger value="mask" disabled={!clip.templateData}>Mask Shapes</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <TabsContent value="resource" className="mt-0 space-y-6">
                                <div className="space-y-4">
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
                                            <p className="text-[10px] text-muted-foreground">
                                                Upload an image or video to replace the current resource.
                                            </p>
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
                            </TabsContent>

                            <TabsContent value="mask" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Maximize2 className="w-4 h-4" />
                                        Shape Geometry
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-end">
                                            <Button variant="destructive" size="sm" onClick={removeActiveShape} disabled={!activeComponentId}>
                                                Remove Selected
                                            </Button>
                                        </div>

                                        {clip.templateData && Object.entries(clip.templateData).map(([id, data]: [string, any]) => (
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
                                                                        const newData = { ...clip.templateData };
                                                                        const current = newData[id];
                                                                        const newProps = { ...current, [prop]: val };

                                                                        const shapeType = current['data-shape-type'] || 'rect';
                                                                        let newD = current.d;
                                                                        const { x, y, width, height } = newProps;

                                                                        if (shapeType === 'rect') newD = getRectPath(x, y, width, height, current.rx || 0, current.ry || 0);
                                                                        else if (shapeType === 'circle') newD = getEllipsePath(x, y, width, height);
                                                                        else if (shapeType === 'triangle') newD = getTrianglePath(x, y, width, height);
                                                                        else if (shapeType === 'star') newD = getStarPath(x, y, width, height);

                                                                        newData[id] = { ...newProps, d: newD };
                                                                        onUpdate({ templateData: newData });
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
