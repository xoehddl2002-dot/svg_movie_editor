import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Image as ImageIcon, Maximize2, Crop as MaskIcon, FlipHorizontal, FlipVertical, RotateCw, RotateCcw, Clock } from "lucide-react"
import { Clip } from "@/features/editor/store/useStore"
import { cn } from "@/lib/utils"
// @ts-ignore
import ReactCrop, { type Crop, type PixelCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getMatrix, deltaTransformPoint } from "@/utils/svg/math"

interface MaskEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

export function MaskEditor({ clip, onUpdate, onClose }: MaskEditorProps) {

    const [duration, setDuration] = useState(clip.duration || 5)

    // Transform state
    const [flipH, setFlipH] = useState(clip.flipH || false)
    const [flipV, setFlipV] = useState(clip.flipV || false)
    const [rotation, setRotation] = useState(clip.rotation || 0)
    const [rotationChanged, setRotationChanged] = useState(false)

    // Mask state for ReactCrop (visual only)
    const [mask, setMask] = useState<Crop | undefined>()
    const [maskShape, setMaskShape] = useState<'rect' | 'circle'>('rect')
    const [cornerRadius, setCornerRadius] = useState(clip.mask?.cornerRadius || 0)

    const imgRef = useRef<HTMLImageElement>(null)
    const [displaySrc, setDisplaySrc] = useState(clip.src)
    const [baseRotation, setBaseRotation] = useState(0)
    const [imageSvgBounds, setImageSvgBounds] = useState({ x: 0, y: 0, width: 1, height: 1 })
    const [activeComponentId, setActiveComponentId] = useState<string | null>(null)

    // Extract original image from mask SVG
    useEffect(() => {
        if (clip.src.startsWith('data:image/svg+xml')) {
            try {
                const svgText = decodeURIComponent(clip.src.split(',')[1]);
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

                // Extract original image
                const imgElement = svgDoc.querySelector('image');
                if (imgElement) {
                    const href = imgElement.getAttribute('href') || imgElement.getAttribute('xlink:href');
                    if (href) {
                        setDisplaySrc(href);
                    }

                    // Extract rotation and bounds
                    try {
                        const matrix = getMatrix(imgElement as SVGGraphicsElement);
                        const transform = deltaTransformPoint(matrix);
                        setBaseRotation(transform.angle || 0);

                        const ix = parseFloat(imgElement.getAttribute('x') || '0');
                        const iy = parseFloat(imgElement.getAttribute('y') || '0');
                        const iw = parseFloat(imgElement.getAttribute('width') || '1');
                        const ih = parseFloat(imgElement.getAttribute('height') || '1');
                        setImageSvgBounds({ x: ix, y: iy, width: iw, height: ih });
                    } catch (e) {
                        console.warn("[MaskEditor] Failed to extract rotation/bounds from image element:", e);
                    }
                }
            } catch (err) {
                console.error("[MaskEditor] Failed to extract image from frame SVG:", err);
            }
        }
    }, [clip.src])

    // Update mask when activeComponentId changes
    useEffect(() => {
        console.log("activeComponentId", activeComponentId);
        console.log(clip.templateData);
        if (!activeComponentId || !clip.templateData || !clip.templateData[activeComponentId]) return;

        const data = clip.templateData[activeComponentId];
        let shapeX, shapeY, shapeW, shapeH;

        if (data.nodeName === 'rect') {
            shapeX = data.x; shapeY = data.y; shapeW = data.width; shapeH = data.height;
        } else if (data.nodeName === 'circle') {
            shapeX = data.cx - data.r; shapeY = data.cy - data.r; shapeW = data.r * 2; shapeH = data.r * 2;
        } else if (data.nodeName === 'ellipse') {
            shapeX = data.cx - data.rx; shapeY = data.cy - data.ry; shapeW = data.rx * 2; shapeH = data.ry * 2;
        }

        if (shapeX !== undefined && shapeY !== undefined && shapeW !== undefined && shapeH !== undefined) {
            // Convert SVG -> Percentage Crop
            const px = ((shapeX - imageSvgBounds.x) / imageSvgBounds.width) * 100;
            const py = ((shapeY - imageSvgBounds.y) / imageSvgBounds.height) * 100;
            const pw = (shapeW / imageSvgBounds.width) * 100;
            const ph = (shapeH / imageSvgBounds.height) * 100;

            setMask({ unit: '%', x: px, y: py, width: pw, height: ph });

            // Update maskShape for ReactCrop visual
            if (data.nodeName === 'circle' || data.nodeName === 'ellipse') {
                setMaskShape('circle');
            } else {
                setMaskShape('rect');
            }
        }
    }, [activeComponentId, imageSvgBounds, clip.templateData])

    const handleMaskChange = (_: PixelCrop, percentCrop: PercentCrop) => {
        setMask(percentCrop);

        if (activeComponentId && clip.templateData && clip.templateData[activeComponentId]) {
            // Convert Percentage Crop -> SVG
            const cx = imageSvgBounds.x + (percentCrop.x / 100) * imageSvgBounds.width;
            const cy = imageSvgBounds.y + (percentCrop.y / 100) * imageSvgBounds.height;
            const cw = (percentCrop.width / 100) * imageSvgBounds.width;
            const ch = (percentCrop.height / 100) * imageSvgBounds.height;

            const newData = { ...clip.templateData };
            const currentItem = newData[activeComponentId];

            if (currentItem.nodeName === 'rect') {
                newData[activeComponentId] = {
                    ...currentItem,
                    x: Math.round(cx * 100) / 100,
                    y: Math.round(cy * 100) / 100,
                    width: Math.round(cw * 100) / 100,
                    height: Math.round(ch * 100) / 100
                };
            } else if (currentItem.nodeName === 'circle') {
                newData[activeComponentId] = {
                    ...currentItem,
                    cx: Math.round((cx + cw / 2) * 100) / 100,
                    cy: Math.round((cy + ch / 2) * 100) / 100,
                    r: Math.round((Math.min(cw, ch) / 2) * 100) / 100
                };
            } else if (currentItem.nodeName === 'ellipse') {
                newData[activeComponentId] = {
                    ...currentItem,
                    cx: Math.round((cx + cw / 2) * 100) / 100,
                    cy: Math.round((cy + ch / 2) * 100) / 100,
                    rx: Math.round((cw / 2) * 100) / 100,
                    ry: Math.round((ch / 2) * 100) / 100
                };
            }

            onUpdate({ templateData: newData });
        }
    };

    const handleSave = () => {
        const updates: Partial<Clip> = {
            duration: duration,
            flipH,
            flipV,
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

    return (
        <>
            <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center gap-2 space-y-0 bg-white dark:bg-zinc-950">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                    <ImageIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg">Edit Mask: {clip.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground">MASK • ID: {clip.id.slice(0, 8)}</p>
                </div>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {/* Left: Preview Area */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 flex items-center justify-center p-8 border-r overflow-hidden relative group">
                    <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none" />

                    <div className="relative shadow-2xl rounded-sm ring-1 ring-border bg-black/50 max-w-full max-h-full overflow-visible">
                        <ReactCrop
                            crop={mask}
                            onChange={handleMaskChange}
                            circularCrop={maskShape === 'circle'}
                            keepSelection
                            className="max-w-full max-h-[60vh] relative"
                        >
                            <img
                                ref={imgRef}
                                src={displaySrc}
                                alt="Preview"
                                className="max-w-full max-h-[60vh] object-contain block"
                                style={{
                                    transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                    transition: 'transform 0.3s ease-in-out',
                                    opacity: 0.5
                                }}
                            />
                            {/* Render Active Mask Shape Overlay */}
                            <svg
                                viewBox={`${imageSvgBounds.x} ${imageSvgBounds.y} ${imageSvgBounds.width} ${imageSvgBounds.height}`}
                                className="absolute inset-0 pointer-events-none overflow-visible"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                    transformOrigin: 'center'
                                }}
                            >
                                {clip.templateData && Object.entries(clip.templateData).map(([id, data]: [string, any]) => {
                                    const isActive = id === activeComponentId;
                                    const commonProps = {
                                        key: id,
                                        fill: isActive ? "rgba(255, 0, 0, 0.3)" : "rgba(0, 0, 255, 0.1)",
                                        stroke: isActive ? "red" : "blue",
                                        strokeWidth: isActive ? 2 : 1,
                                        vectorEffect: "non-scaling-stroke" as any,
                                        style: { cursor: 'pointer', pointerEvents: 'auto' } as React.CSSProperties
                                    };

                                    // Add onClick handler to select component
                                    const clickProps = {
                                        onClick: (e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            setActiveComponentId(id);
                                        }
                                    };

                                    if (data.nodeName === 'rect') {
                                        return <rect x={data.x} y={data.y} width={data.width} height={data.height} rx={data.rx} ry={data.ry} {...commonProps} {...clickProps} />;
                                    } else if (data.nodeName === 'circle') {
                                        return <circle cx={data.cx} cy={data.cy} r={data.r} {...commonProps} {...clickProps} />;
                                    } else if (data.nodeName === 'ellipse') {
                                        return <ellipse cx={data.cx} cy={data.cy} rx={data.rx} ry={data.ry} {...commonProps} {...clickProps} />;
                                    } else if (data.nodeName === 'path') {
                                        return <path d={data.d} {...commonProps} {...clickProps} />;
                                    } else if (data.nodeName === 'polygon') {
                                        return <polygon points={data.points} {...commonProps} {...clickProps} />;
                                    }
                                    return null;
                                })}
                            </svg>
                        </ReactCrop>
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-[400px] shrink-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden border-l">
                    <Tabs defaultValue="transform" className="flex-1 flex flex-col">
                        <div className="px-4 pt-4 shrink-0">
                            <TabsList className="w-full grid grid-cols-2">
                                <TabsTrigger value="transform">Mask & Transform</TabsTrigger>
                                <TabsTrigger value="components" disabled={!clip.templateData}>Components</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <TabsContent value="transform" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <MaskIcon className="w-4 h-4" />
                                        Mask Area
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
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

                            <TabsContent value="components" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Maximize2 className="w-4 h-4" />
                                        SVG Geometry
                                    </div>
                                    <div className="space-y-4">
                                        {clip.templateData && Object.entries(clip.templateData).map(([id, data]: [string, any]) => (
                                            <div key={id} className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                                <div className="flex items-center justify-between border-b pb-2 mb-2">
                                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-50">{id}</span>
                                                    <Button
                                                        variant={activeComponentId === id ? "secondary" : "ghost"}
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2"
                                                        onClick={() => setActiveComponentId(activeComponentId === id ? null : id)}
                                                    >
                                                        {activeComponentId === id ? "Editing..." : "Visual Edit"}
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {['x', 'y', 'width', 'height', 'rx', 'ry', 'r', 'cx', 'cy'].map(prop => (
                                                        data[prop] !== undefined && (
                                                            <div key={prop} className="space-y-1">
                                                                <Label className="text-[10px] uppercase font-bold opacity-70">{prop}</Label>
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-xs font-mono"
                                                                    value={data[prop]}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                        const newData = { ...clip.templateData };
                                                                        newData[id] = { ...newData[id], [prop]: Number(e.target.value) };
                                                                        onUpdate({ templateData: newData });
                                                                    }}
                                                                />
                                                            </div>
                                                        )
                                                    ))}
                                                </div>

                                                {data.d !== undefined && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase font-bold opacity-70">Path Data (d)</Label>
                                                        <Input
                                                            className="h-8 text-xs font-mono"
                                                            value={data.d}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                const newData = { ...clip.templateData };
                                                                newData[id] = { ...newData[id], d: e.target.value };
                                                                onUpdate({ templateData: newData });
                                                            }}
                                                        />
                                                    </div>
                                                )}
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
