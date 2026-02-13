'use client'

import { useStore, type Clip } from "@/store/useStore"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Settings, X, Trash2 } from "lucide-react"

const DEFAULT_FILTER = { brightness: 1, contrast: 1, saturate: 1, blur: 0 }
const fonts = ['Inter', 'Roboto', 'Arial', 'Times New Roman', 'Courier New']

interface ColorPickerProps {
    value?: string
    onChange: (value: string) => void
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
    const presets = ['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

    return (
        <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
                {presets.map(color => (
                    <div
                        key={color}
                        className={`w-6 h-6 rounded-full cursor-pointer border ${value === color ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onChange(color)}
                    />
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

export function ClipProperties({ clip }: ClipPropertiesProps) {
    const { setSelectedClipId, updateClip, removeClip, setEditingClipId } = useStore()

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

                {(clip.type === 'image' || clip.type === 'mask' || clip.type === 'video' || clip.type === 'audio') && (
                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={() => setEditingClipId(clip.id)}
                    >
                        <Settings className="h-4 w-4" />
                        Open Advanced Editor
                    </Button>
                )}

                {/* Position & Size */}
                {(clip.type === 'image' || clip.type === 'mask' || clip.type === 'text' || clip.type === 'video' || clip.type === 'shape' || clip.type === 'icon') && (
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
                                        value={clip.width || 100}
                                        onChange={(e) => updateClip(clip.id, { width: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                            {clip.type !== 'text' && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Height (px)</Label>
                                    <Input
                                        type="number"
                                        value={clip.height || 100}
                                        onChange={(e) => updateClip(clip.id, { height: Number(e.target.value) })}
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
                            <Label>Content</Label>
                            <Input
                                value={clip.text || ''}
                                onChange={(e) => updateClip(clip.id, { text: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Font Family</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {fonts.map(font => (
                                    <Button
                                        key={font}
                                        variant={clip.fontFamily === font ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => updateClip(clip.id, { fontFamily: font })}
                                        style={{ fontFamily: font }}
                                        className="h-8 text-xs"
                                    >
                                        {font}
                                    </Button>
                                ))}
                            </div>
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
                {(clip.type === 'video' || clip.type === 'audio') && (
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
                {clip.type === 'video' && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Video Edit</Label>

                        <div className="space-y-2">
                            <Label>Trim Start (Offset)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={clip.mediaStart || 0}
                                    onChange={(e) => updateClip(clip.id, { mediaStart: Math.max(0, Number(e.target.value)) })}
                                />
                                <span className="text-xs text-muted-foreground">sec</span>
                            </div>
                        </div>


                    </div>
                )}

                {/* Image Edit (Mask & Filter) */}
                {(clip.type === 'image' || clip.type === 'mask') && (
                    <div className="space-y-4">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Image Mask & Filter</Label>

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

                                {data.fill !== undefined && (
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
