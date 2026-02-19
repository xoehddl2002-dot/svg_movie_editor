import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Film, Scissors, Maximize2, Crop as MaskIcon, FlipHorizontal, FlipVertical, RotateCw, RotateCcw } from "lucide-react"
import { Clip } from "@/features/editor/store/useStore"
import { cn } from "@/lib/utils"
// @ts-ignore
import ReactCrop, { type Crop, type PixelCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface VideoEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

export function VideoEditor({ clip, onUpdate, onClose }: VideoEditorProps) {
    const [start, setStart] = useState(clip.mediaStart || 0)
    const [duration, setDuration] = useState(clip.duration || 0)
    const [opacity, setOpacity] = useState((clip.opacity ?? 1) * 100)

    // Transform state
    const [flipH, setFlipH] = useState(clip.flipH || false)
    const [flipV, setFlipV] = useState(clip.flipV || false)
    const [rotation, setRotation] = useState(clip.rotation || 0)
    const [rotationChanged, setRotationChanged] = useState(false)

    // Mask state
    const [mask, setMask] = useState<Crop | undefined>(() => {
        if (!clip.mask) return undefined
        return { ...clip.mask, unit: '%' } as Crop
    })
    const [maskShape, setMaskShape] = useState<'rect' | 'circle'>(clip.mask?.shape || 'rect')
    const [cornerRadius, setCornerRadius] = useState(clip.mask?.cornerRadius || 0)

    const videoRef = useRef<HTMLVideoElement>(null)

    const handleSave = () => {
        const updates: Partial<Clip> = {
            mediaStart: start,
            duration: duration,
            opacity: opacity / 100,
            flipH,
            flipV,
            mask: {
                ...(mask as any),
                shape: maskShape,
                cornerRadius
            }
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

    const onVideoLoaded = () => {
        if (!mask && !clip.mask) {
            setMask({
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
                    <Film className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg">Edit Video: {clip.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground">VIDEO • ID: {clip.id.slice(0, 8)}</p>
                </div>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {/* Left: Preview Area */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 flex items-center justify-center p-8 border-r overflow-hidden relative group">
                    <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none" />

                    <div className="relative shadow-2xl rounded-sm ring-1 ring-border bg-black/50 max-w-full max-h-full overflow-visible">
                        <ReactCrop
                            crop={mask}
                            onChange={(_: PixelCrop, percentCrop: PercentCrop) => setMask(percentCrop)}
                            circularCrop={maskShape === 'circle'}
                            className="max-w-full max-h-[60vh]"
                        >
                            <video
                                ref={videoRef}
                                src={clip.src}
                                className="max-w-full max-h-[60vh] object-contain block"
                                onLoadedMetadata={onVideoLoaded}
                                controls
                                style={{
                                    transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1}) rotate(${rotation}deg)`,
                                    transition: 'transform 0.3s ease-in-out'
                                }}
                            />
                        </ReactCrop>
                    </div>

                    <div className="absolute bottom-4 left-4 text-xs font-mono bg-white/80 dark:bg-black/80 backdrop-blur px-2 py-1 rounded border pointer-events-none">
                        Original Size: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight} (Placeholder)
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-[400px] shrink-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden border-l">
                    <Tabs defaultValue={clip.attr_rock ? "transform" : "general"} className="flex-1 flex flex-col">
                        <div className="px-4 pt-4 shrink-0">
                            <TabsList className="w-full grid grid-cols-2">
                                {!clip.attr_rock && <TabsTrigger value="general">Properties</TabsTrigger>}
                                <TabsTrigger value="transform">Mask & Transform</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <TabsContent value="general" className="mt-0 space-y-6">
                                {/* Timing Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Scissors className="w-4 h-4" />
                                        Timing & Trim
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs">Start Offset (s)</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{start.toFixed(2)}s</span>
                                                </div>
                                                <Slider
                                                    value={[start]}
                                                    max={600}
                                                    step={0.1}
                                                    onValueChange={([v]) => setStart(v)}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Start point within the source video</p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs">Duration (s)</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{duration.toFixed(2)}s</span>
                                                </div>
                                                <Slider
                                                    value={[duration]}
                                                    max={600}
                                                    step={0.1}
                                                    onValueChange={([v]) => setDuration(v)}
                                                />
                                                <p className="text-[10px] text-muted-foreground">Playback duration on timeline</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="transform" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <MaskIcon className="w-4 h-4" />
                                        Mask Area
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Shape</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={maskShape === 'rect' ? 'secondary' : 'outline'}
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => setMaskShape('rect')}
                                                >
                                                    Rectangle
                                                </Button>
                                                <Button
                                                    variant={maskShape === 'circle' ? 'secondary' : 'outline'}
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => setMaskShape('circle')}
                                                >
                                                    Circle
                                                </Button>
                                            </div>
                                        </div>

                                        {maskShape === 'rect' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs">Corner Radius</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{cornerRadius}%</span>
                                                </div>
                                                <Slider
                                                    value={[cornerRadius]}
                                                    max={50}
                                                    step={1}
                                                    onValueChange={([v]) => setCornerRadius(v)}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">Rotation</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={Math.round(rotation)}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Maximize2 className="w-4 h-4" />
                                        Opacity
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs">Opacity</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{opacity}%</span>
                                            </div>
                                            <Slider
                                                value={[opacity]}
                                                max={100}
                                                step={1}
                                                onValueChange={([v]) => setOpacity(v)}
                                            />
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
