'use client'

import { useStore, type Clip } from "@/features/editor/store/useStore"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Settings, X, Trash2, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadFont } from "@/utils/fonts"
import { useState, useEffect } from "react"

const DEFAULT_FILTER = { brightness: 1, contrast: 1, saturate: 1, blur: 0 }

interface ColorPickerProps {
    value?: string
    onChange: (value: string) => void
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
    const presets = ['none', '#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

    return (
        <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
                {presets.map(color => (
                    <div
                        key={color}
                        className={`w-6 h-6 rounded-full cursor-pointer border flex item-center justify-center relative overflow-hidden ${value === color ? 'ring-2 ring-primary ring-offset-2 z-10' : ''}`}
                        style={{ backgroundColor: color === 'none' ? 'transparent' : color }}
                        onClick={() => onChange(color)}
                        title={color === 'none' ? 'No Color (Transparent)' : color}
                    >
                        {color === 'none' && (
                            <div className="absolute inset-0 w-full h-full">
                                <svg width="100%" height="100%" viewBox="0 0 24 24">
                                    <line x1="0" y1="24" x2="24" y2="0" stroke="red" strokeWidth="2" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <div className="relative w-9 h-9 flex-shrink-0 rounded-md overflow-hidden border border-input shadow-sm">
                    <input
                        type="color"
                        value={value || '#000000'}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer p-0 border-0"
                    />
                </div>
                <Input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 font-mono text-xs"
                    placeholder="#000000"
                    maxLength={9}
                />
            </div>
        </div>
    )
}

interface ClipPropertiesProps {
    clip: Clip
}

export function ClipProperties({ clip }: { clip: Clip }) {
    const { setSelectedClipId, updateClip, removeClip, setEditingClipId } = useStore()

    return (
        <ClipPropertiesContent clip={clip} updateClip={updateClip} setSelectedClipId={setSelectedClipId} removeClip={removeClip} setEditingClipId={setEditingClipId} />
    )
}

function VideoTrimSlider({ clip, updateClip }: { clip: Clip, updateClip: (id: string, updates: Partial<Clip>) => void }) {
    const [sourceDuration, setSourceDuration] = useState<number>(0);

    useEffect(() => {
        const loadMetadata = () => {
            const video = document.createElement('video');
            video.src = clip.src;
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                if (isFinite(video.duration)) {
                    setSourceDuration(video.duration);
                }
            };
        };
        loadMetadata();
    }, [clip.src]);

    const start = clip.mediaStart || 0;
    const end = start + (clip.duration || 0);
    // Use sourceDuration if available, otherwise fallback to reasonable max
    const max = sourceDuration || Math.max(end + 10, 60);

    return (
        <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Start: {start.toFixed(1)}s</span>
                <span>End: {end.toFixed(1)}s</span>
            </div>
            <Slider
                value={[start, end]}
                max={max}
                step={0.1}
                min={0}
                minStepsBetweenThumbs={0.1}
                onValueChange={([newStart, newEnd]) => {
                    // Constraint: End must be > Start. Slider handles this but we ensure min duration.
                    const duration = newEnd - newStart;
                    if (duration < 0.1) return;

                    updateClip(clip.id, {
                        mediaStart: newStart,
                        duration: duration
                    });
                }}
                className="py-4"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0s</span>
                <span>{max.toFixed(1)}s</span>
            </div>
        </div>
    );
}

function ClipPropertiesContent({ clip, updateClip, setSelectedClipId, removeClip, setEditingClipId }: any) {
    const [fonts, setFonts] = useState<string[]>([])

    useEffect(() => {
        fetch('/api/fonts')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setFonts(data)
            })
            .catch(err => console.error('Failed to fetch fonts:', err))
    }, [])

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Properties
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedClipId(null)}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <Separator />

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                        value={clip.name}
                        onChange={(e) => updateClip(clip.id, { name: e.target.value })}
                    />
                </div>

                {(clip.type === 'mask' || clip.type === 'audio') && (
                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={() => setEditingClipId(clip.id)}
                    >
                        <Settings className="h-4 w-4" />
                        Open Advanced Editor
                    </Button>
                )}

                {/* Timing */}
                <div className="space-y-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Timing</Label>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="text-xs">Duration (s)</Label>
                            <span className="text-xs font-mono text-muted-foreground">{(clip.duration || 0).toFixed(1)}s</span>
                        </div>
                        <Slider
                            value={[clip.duration || 5]}
                            max={60}
                            step={0.1}
                            onValueChange={([v]) => updateClip(clip.id, { duration: v })}
                        />
                    </div>
                </div>

                {/* Position & Size */}
                {(clip.type === 'mask' || clip.type === 'text' || clip.type === 'shape' || clip.type === 'icon') && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Transform</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">X Position (px)</Label>
                                <Input
                                    type="number"
                                    value={clip.x || 0}
                                    onChange={(e) => updateClip(clip.id, { x: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Y Position (px)</Label>
                                <Input
                                    type="number"
                                    value={clip.y || 0}
                                    onChange={(e) => updateClip(clip.id, { y: Number(e.target.value) })}
                                />
                            </div>
                            {clip.type !== 'text' && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Width (px)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round((clip.width || 100) * ((clip.mask?.width ?? 100) / 100))}
                                        onChange={(e) => {
                                            const visualW = Number(e.target.value);
                                            const maskW = clip.mask?.width ?? 100;
                                            updateClip(clip.id, { width: maskW > 0 ? visualW / (maskW / 100) : visualW });
                                        }}
                                    />
                                </div>
                            )}
                            {clip.type !== 'text' && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Height (px)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round((clip.height || 100) * ((clip.mask?.height ?? 100) / 100))}
                                        onChange={(e) => {
                                            const visualH = Number(e.target.value);
                                            const maskH = clip.mask?.height ?? 100;
                                            updateClip(clip.id, { height: maskH > 0 ? visualH / (maskH / 100) : visualH });
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Opacity</Label>
                            <Slider
                                value={[clip.opacity ?? 1]}
                                max={1}
                                step={0.01}
                                onValueChange={(val) => updateClip(clip.id, { opacity: val[0] })}
                            />
                        </div>
                    </div>
                )}

                {/* Text Properties */}
                {clip.type === 'text' && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Typography</Label>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Content</Label>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    {(clip.text || '').length} / {clip.max_length ?? 15}
                                </span>
                            </div>
                            <Input
                                value={clip.text || ''}
                                maxLength={clip.max_length ?? 15}
                                onChange={(e) => updateClip(clip.id, { text: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Font Family</Label>
                            <Select
                                value={clip.fontFamily || ""}
                                onValueChange={async (font) => {
                                    await loadFont({
                                        family: font,
                                        url: `/assets/font/${font}.woff`
                                    });
                                    updateClip(clip.id, { fontFamily: font });
                                }}
                            >
                                <SelectTrigger className="w-full text-xs h-8">
                                    <SelectValue placeholder="Select a font" />
                                </SelectTrigger>
                                <SelectContent side="bottom" position="popper" className="bg-transparent backdrop-blur-md shadow-lg border-white/10 prevent-deselect">
                                    {fonts.map(font => (
                                        <SelectItem 
                                            key={font} 
                                            value={font} 
                                            style={{ fontFamily: `"${font}"` }}
                                            className="focus:bg-white/10 focus:text-white cursor-pointer transition-colors"
                                        >
                                            {font}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Font Size</Label>
                            <Slider
                                value={[clip.fontSize || 120]}
                                min={10}
                                max={200}
                                step={1}
                                onValueChange={(val) => updateClip(clip.id, { fontSize: val[0] })}
                            />
                            <div className="text-right text-xs text-muted-foreground">{clip.fontSize || 120}px</div>
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <ColorPicker
                                value={clip.color}
                                onChange={(color) => updateClip(clip.id, { color })}
                            />
                        </div>
                    </div>
                )}

                {/* Video/Audio Properties */}
                {(clip.type === 'audio' || (clip.type === 'mask' && (clip.src.match(/\.(mp4|webm|mov|m4v)$/i) || clip.src.startsWith('blob:video/')))) && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Audio</Label>
                        <div className="space-y-2">
                            <Label>Volume</Label>
                            <Slider
                                value={[clip.volume ?? 1]}
                                max={1}
                                step={0.01}
                                onValueChange={(val) => updateClip(clip.id, { volume: val[0] })}
                            />
                        </div>
                    </div>
                )}

                {/* Video Trim/Mask */}
                {clip.type === 'mask' && (clip.src.match(/\.(mp4|webm|mov|m4v)$/i) || clip.src.startsWith('blob:video/')) && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Video Edit</Label>
                        <VideoTrimSlider clip={clip} updateClip={updateClip} />
                    </div>
                )}

                {/* Image Edit (Mask & Filter) */}
                {clip.type === 'mask' && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Image/Video Mask & Filter</Label>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Filters</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => updateClip(clip.id, { filter: clip.filter ? undefined : DEFAULT_FILTER })}
                                >
                                    {clip.filter ? 'Reset' : 'Enable'}
                                </Button>
                            </div>
                            {clip.filter && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Brightness ({clip.filter.brightness})</Label>
                                        <Slider
                                            value={[clip.filter.brightness]} min={0} max={2} step={0.1}
                                            onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, brightness: val[0] } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Contrast ({clip.filter.contrast})</Label>
                                        <Slider
                                            value={[clip.filter.contrast]} min={0} max={2} step={0.1}
                                            onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, contrast: val[0] } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Saturation ({clip.filter.saturate})</Label>
                                        <Slider
                                            value={[clip.filter.saturate]} min={0} max={2} step={0.1}
                                            onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, saturate: val[0] } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Blur ({clip.filter.blur}px)</Label>
                                        <Slider
                                            value={[clip.filter.blur]} min={0} max={10} step={0.5}
                                            onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, blur: val[0] } })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Shape Properties */}
                {clip.type === 'shape' && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Appearance</Label>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <ColorPicker
                                value={clip.color}
                                onChange={(color) => updateClip(clip.id, { color })}
                            />
                        </div>
                    </div>
                )}

                {/* Template Properties (Dynamic SVG Elements) */}
                {clip.templateData && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Template Elements</Label>
                        {Object.entries(clip.templateData).map(([id, data]: [string, any]) => (
                            <div key={id} className="p-3 border rounded-md space-y-3 bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-muted-foreground">{id}</span>
                                </div>

                                {data.text !== undefined && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Content</Label>
                                        <Input
                                            className="h-8 text-xs"
                                            value={data.text}
                                            onChange={(e) => {
                                                const newData = { ...clip.templateData };
                                                newData[id] = { ...newData[id], text: e.target.value };
                                                updateClip(clip.id, { templateData: newData });
                                            }}
                                        />
                                    </div>
                                )}

                                {data.fill !== undefined && !['video', 'image'].includes(clip.mediaType || '') && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Color</Label>
                                        <ColorPicker
                                            value={data.fill}
                                            onChange={(color) => {
                                                const newData = { ...clip.templateData };
                                                newData[id] = { ...newData[id], fill: color };
                                                updateClip(clip.id, { templateData: newData });
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <Separator className="my-6" />

                <Button
                    variant="destructive"
                    className="w-full h-12 flex items-center justify-center gap-2 mb-10 bg-red-600 hover:bg-red-700 text-white font-bold shadow-md hover:shadow-lg transition-all"
                    onClick={() => {
                        if (window.confirm("Are you sure you want to delete this resource?")) {
                            removeClip(clip.id);
                        }
                    }}
                >
                    <Trash2 className="h-5 w-5" />
                    DELETE RESOURCE
                </Button>
            </div>
        </div>
    )
}
