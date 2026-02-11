import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Image as ImageIcon, Maximize2, Crop as CropIcon, FlipHorizontal, FlipVertical, RotateCw, RotateCcw, Clock } from "lucide-react"
import { Clip } from "@/store/useStore"
import { cn } from "@/lib/utils"
// @ts-ignore
import ReactCrop, { type Crop, type PixelCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

function transformCrop(crop: Crop, rotation: number, flipH: boolean, flipV: boolean, inverse: boolean): Crop {
    let { x, y, width: w, height: h } = crop;

    // Normalize rotation
    const rot = (rotation % 360 + 360) % 360;

    if (inverse) {
        // View -> Original (Save logic)

        // 1. Un-Flip
        if (flipH) x = 100 - (x + w);
        if (flipV) y = 100 - (y + h);

        // 2. Un-Rotate
        if (rot === 90) {
            const newX = y;
            const newY = 100 - (x + w);
            x = newX;
            y = newY;
            const temp = w; w = h; h = temp;
        } else if (rot === 180) {
            x = 100 - (x + w);
            y = 100 - (y + h);
        } else if (rot === 270) {
            const newX = 100 - (y + h);
            const newY = x;
            x = newX;
            y = newY;
            const temp = w; w = h; h = temp;
        }
    } else {
        // Original -> View (Init logic)
        // 1. Rotate
        if (rot === 90) {
            const newX = 100 - (y + h);
            const newY = x;
            x = newX;
            y = newY;
            const temp = w; w = h; h = temp;
        } else if (rot === 180) {
            x = 100 - (x + w);
            y = 100 - (y + h);
        } else if (rot === 270) {
            const newX = y;
            const newY = 100 - (x + w);
            x = newX;
            y = newY;
            const temp = w; w = h; h = temp;
        }

        // 2. Flip
        if (flipH) x = 100 - (x + w);
        if (flipV) y = 100 - (y + h);
    }

    return { unit: '%', x, y, width: w, height: h };
}


export function ImageEditor({ clip, onUpdate, onClose }: ImageEditorProps) {
    const [duration, setDuration] = useState(clip.duration || 5)

    // Transform state
    const [flipH, setFlipH] = useState(clip.flipH || false)
    const [flipV, setFlipV] = useState(clip.flipV || false)
    const [rotation, setRotation] = useState(clip.rotation || 0)

    // Crop state
    const [crop, setCrop] = useState<Crop | undefined>(() => {
        if (!clip.crop) return undefined
        return transformCrop(
            { ...clip.crop, unit: '%' } as Crop,
            clip.rotation || 0,
            clip.flipH || false,
            clip.flipV || false,
            false
        )
    })

    const imgRef = useRef<HTMLImageElement>(null)

    const handleSave = () => {
        let finalCrop = undefined;
        let newWidth = clip.width;
        let newHeight = clip.height;

        if (crop) {
            // Transform View Crop -> Original Crop
            finalCrop = transformCrop(
                crop,
                rotation,
                flipH,
                flipV,
                true
            )

            // Adjust clip dimensions based on crop and natural aspect ratio
            const img = imgRef.current;
            if (img && img.naturalWidth && img.naturalHeight) {
                const naturalAR = img.naturalWidth / img.naturalHeight;
                // Target Aspect Ratio = (Crop Width px / Crop Height px)
                // = (naturalW * cropW% / naturalH * cropH%)
                // = naturalAR * (cropW / cropH)
                // Note: finalCrop is in % relative to original dimensions (100x100), 
                // so we can use its width/height directly as ratio modifiers.

                const targetAR = naturalAR * (finalCrop.width / finalCrop.height);

                // Keep current width (or default), adjust height
                const currentWidth = clip.width || 500;
                newWidth = currentWidth;
                newHeight = currentWidth / targetAR;
            }
        }

        onUpdate({
            duration: duration,
            flipH,
            flipV,
            rotation,
            crop: finalCrop as any,
            width: newWidth,
            height: newHeight
        })
        onClose()
    }

    const rotateLeft = () => setRotation(r => ((r - 90) % 360 + 360) % 360)
    const rotateRight = () => setRotation(r => (r + 90) % 360)
    const toggleFlipH = () => setFlipH(f => !f)
    const toggleFlipV = () => setFlipV(f => !f)

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        // If no crop exists AND this is the first load, set full crop
        if (!crop && !clip.crop) {
            setCrop({
                unit: '%',
                width: 100,
                height: 100,
                x: 0,
                y: 0
            })
        }
    }

    return (
        <>
            <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center gap-2 space-y-0 bg-white dark:bg-zinc-950">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                    <ImageIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg">Edit Image: {clip.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground">IMAGE • ID: {clip.id.slice(0, 8)}</p>
                </div>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {/* Left: Preview Area */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 flex items-center justify-center p-8 border-r overflow-hidden relative group">
                    <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none" />

                    <div className="relative shadow-2xl rounded-sm ring-1 ring-border bg-black/50 max-w-full max-h-full overflow-visible">
                        <ReactCrop
                            crop={crop}
                            onChange={(_: PixelCrop, percentCrop: PercentCrop) => setCrop(percentCrop)}
                            className="max-w-full max-h-[60vh]"
                        >
                            <img
                                ref={imgRef}
                                src={clip.src}
                                alt="Preview"
                                className="max-w-full max-h-[60vh] object-contain block"
                                onLoad={onImageLoad}
                                style={{
                                    transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                    transition: 'transform 0.3s ease-in-out'
                                }}
                            />
                        </ReactCrop>
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-[400px] shrink-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden border-l">
                    <Tabs defaultValue="general" className="flex-1 flex flex-col">
                        <div className="px-4 pt-4 shrink-0">
                            <TabsList className="w-full grid grid-cols-2">
                                <TabsTrigger value="general">Properties</TabsTrigger>
                                <TabsTrigger value="transform">Transform</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <TabsContent value="general" className="mt-0 space-y-6">
                                {/* Duration Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Clock className="w-4 h-4" />
                                        Duration
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs">Duration (s)</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{duration.toFixed(1)}s</span>
                                            </div>
                                            <Slider
                                                value={[duration]}
                                                max={30}
                                                step={0.5}
                                                onValueChange={([v]) => setDuration(v)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="transform" className="mt-0 space-y-6">
                                {/* Crop & Transform Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <CropIcon className="w-4 h-4" />
                                        Transform
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Rotation</Label>
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
