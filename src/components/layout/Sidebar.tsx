'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Type, Image as ImageIcon, FileVideo, Shapes, Music, LayoutTemplate, X, Settings, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function Sidebar() {
    const { tracks, selectedClipId, setSelectedClipId, updateClip, initProjectWithTemplate, removeClip, setEditingClipId } = useStore()

    // Initial crop constant
    const DEFAULT_CROP = { x: 0, y: 0, width: 100, height: 100 }
    // Initial filter constant
    const DEFAULT_FILTER = { brightness: 1, contrast: 1, saturate: 1, blur: 0 }

    // For Next.js, asset loading needs to be configured differently
    // You can place assets in the public folder and reference them directly
    const [videoItems, setVideoItems] = useState<{ src: string, thumbnail?: string }[]>([])
    const [images, setImages] = useState<string[]>([])
    const [shapeImages, setShapeImages] = useState<string[]>([])
    const [audios, setAudios] = useState<string[]>([])
    const [customSvg, setCustomSvg] = useState('')

    interface TemplateItem {
        id: string
        type: 'F' | 'S' | 'T'
        name: string
        png: string
        svg: string
        json: string
    }
    const [templateItems, setTemplateItems] = useState<{ F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] }>({ F: [], S: [], T: [] })

    // Load templates from API
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const response = await fetch('/api/templates')
                if (!response.ok) {
                    throw new Error('Failed to fetch templates')
                }

                const templates: TemplateItem[] = await response.json()

                const categorized: { F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] } = { F: [], S: [], T: [] }
                templates.forEach(item => {
                    categorized[item.type].push(item)
                })

                setTemplateItems(categorized)
            } catch (error) {
                console.error('Failed to load templates:', error)
            }
        }

        loadTemplates()
    }, [])

    // Load assets from API
    useEffect(() => {
        const loadAssets = async () => {
            try {
                const response = await fetch('/api/assets')
                if (!response.ok) {
                    throw new Error('Failed to fetch assets')
                }

                const assets = await response.json()

                setVideoItems(assets.videos || [])
                setImages(assets.images || [])
                setAudios(assets.audio || [])
                setShapeImages(assets.shapes || [])
            } catch (error) {
                console.error('Failed to load assets:', error)
            }
        }

        loadAssets()
    }, [])

    const handleDragStart = (e: React.DragEvent, type: string, src: string) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type, src }))
    }

    const selectedClip = selectedClipId
        ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
        : null

    // Mock Fonts
    const fonts = ['Inter', 'Roboto', 'Arial', 'Times New Roman', 'Courier New']

    // Render properties based on clip type
    const renderProperties = () => {
        if (!selectedClip) return null

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
                            value={selectedClip.name}
                            onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                        />
                    </div>

                    {(selectedClip.type === 'image' || selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={() => setEditingClipId(selectedClip.id)}
                        >
                            <Settings className="h-4 w-4" />
                            Open Advanced Editor
                        </Button>
                    )}

                    {/* Position & Size */}
                    {(selectedClip.type === 'image' || selectedClip.type === 'text' || selectedClip.type === 'video' || selectedClip.type === 'shape') && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Transform</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">X Position (px)</Label>
                                    <Input
                                        type="number"
                                        value={selectedClip.x || 0}
                                        onChange={(e) => updateClip(selectedClip.id, { x: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Y Position (px)</Label>
                                    <Input
                                        type="number"
                                        value={selectedClip.y || 0}
                                        onChange={(e) => updateClip(selectedClip.id, { y: Number(e.target.value) })}
                                    />
                                </div>
                                {selectedClip.type !== 'text' && (
                                    <div className="space-y-1">
                                        <Label className="text-xs">Width (px)</Label>
                                        <Input
                                            type="number"
                                            value={selectedClip.width || 100}
                                            onChange={(e) => updateClip(selectedClip.id, { width: Number(e.target.value) })}
                                        />
                                    </div>
                                )}
                                {selectedClip.type !== 'text' && (
                                    <div className="space-y-1">
                                        <Label className="text-xs">Height (px)</Label>
                                        <Input
                                            type="number"
                                            value={selectedClip.height || 100}
                                            onChange={(e) => updateClip(selectedClip.id, { height: Number(e.target.value) })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Opacity</Label>
                                <Slider
                                    value={[selectedClip.opacity ?? 1]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(val) => updateClip(selectedClip.id, { opacity: val[0] })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Text Properties */}
                    {selectedClip.type === 'text' && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Typography</Label>
                            <div className="space-y-2">
                                <Label>Content</Label>
                                <Input
                                    value={selectedClip.text || ''}
                                    onChange={(e) => updateClip(selectedClip.id, { text: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Font Family</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {fonts.map(font => (
                                        <Button
                                            key={font}
                                            variant={selectedClip.fontFamily === font ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => updateClip(selectedClip.id, { fontFamily: font })}
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
                                    value={[selectedClip.fontSize || 120]}
                                    min={10}
                                    max={200}
                                    step={1}
                                    onValueChange={(val) => updateClip(selectedClip.id, { fontSize: val[0] })}
                                />
                                <div className="text-right text-xs text-muted-foreground">{selectedClip.fontSize || 120}px</div>
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(color => (
                                        <div
                                            key={color}
                                            className={`w-6 h-6 rounded-full cursor-pointer border ${selectedClip.color === color ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => updateClip(selectedClip.id, { color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Video/Audio Properties */}
                    {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Audio</Label>
                            <div className="space-y-2">
                                <Label>Volume</Label>
                                <Slider
                                    value={[selectedClip.volume ?? 1]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(val) => updateClip(selectedClip.id, { volume: val[0] })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Video Trim/Crop */}
                    {selectedClip.type === 'video' && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Video Edit</Label>

                            <div className="space-y-2">
                                <Label>Trim Start (Offset)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={selectedClip.mediaStart || 0}
                                        onChange={(e) => updateClip(selectedClip.id, { mediaStart: Math.max(0, Number(e.target.value)) })}
                                    />
                                    <span className="text-xs text-muted-foreground">sec</span>
                                </div>
                            </div>


                        </div>
                    )}

                    {/* Image Edit (Crop & Filter) */}
                    {selectedClip.type === 'image' && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Image Edit</Label>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Filters</Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => updateClip(selectedClip.id, { filter: selectedClip.filter ? undefined : DEFAULT_FILTER })}
                                    >
                                        {selectedClip.filter ? 'Reset' : 'Enable'}
                                    </Button>
                                </div>
                                {selectedClip.filter && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Brightness ({selectedClip.filter.brightness})</Label>
                                            <Slider
                                                value={[selectedClip.filter.brightness]} min={0} max={2} step={0.1}
                                                onValueChange={(val) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, brightness: val[0] } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Contrast ({selectedClip.filter.contrast})</Label>
                                            <Slider
                                                value={[selectedClip.filter.contrast]} min={0} max={2} step={0.1}
                                                onValueChange={(val) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, contrast: val[0] } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Saturation ({selectedClip.filter.saturate})</Label>
                                            <Slider
                                                value={[selectedClip.filter.saturate]} min={0} max={2} step={0.1}
                                                onValueChange={(val) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, saturate: val[0] } })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Blur ({selectedClip.filter.blur}px)</Label>
                                            <Slider
                                                value={[selectedClip.filter.blur]} min={0} max={10} step={0.5}
                                                onValueChange={(val) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, blur: val[0] } })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Shape Properties */}
                    {selectedClip.type === 'shape' && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Appearance</Label>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                                        <div
                                            key={color}
                                            className={`w-6 h-6 rounded-full cursor-pointer border ${selectedClip.color === color ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => updateClip(selectedClip.id, { color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Template Properties (Dynamic SVG Elements) */}
                    {selectedClip.templateData && (
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">Template Elements</Label>
                            {Object.entries(selectedClip.templateData).map(([id, data]: [string, any]) => (
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
                                                    const newData = { ...selectedClip.templateData };
                                                    newData[id] = { ...newData[id], text: e.target.value };
                                                    updateClip(selectedClip.id, { templateData: newData });
                                                }}
                                            />
                                        </div>
                                    )}

                                    {data.fill !== undefined && (
                                        <div className="space-y-1">
                                            <Label className="text-[10px]">Color</Label>
                                            <div className="flex gap-1 flex-wrap">
                                                {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                                                    <div
                                                        key={color}
                                                        className={`w-5 h-5 rounded-full cursor-pointer border ${data.fill === color ? 'ring-1 ring-primary ring-offset-1' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => {
                                                            const newData = { ...selectedClip.templateData };
                                                            newData[id] = { ...newData[id], fill: color };
                                                            updateClip(selectedClip.id, { templateData: newData });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}


                    <Separator className="my-6" />

                    <Button
                        variant="destructive"
                        className="w-full flex items-center justify-center gap-2 mb-10"
                        onClick={() => {
                            if (window.confirm("Are you sure you want to delete this resource?")) {
                                removeClip(selectedClip.id);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Resource
                    </Button>
                </div>
            </div>
        )
    }

    if (selectedClip) {
        return (
            <div className="flex h-full w-80 flex-col border-r bg-background prevent-deselect">
                <ScrollArea className="h-full">
                    {renderProperties()}
                </ScrollArea>
            </div>
        )
    }

    return (
        <div className="flex h-full w-80 flex-col border-r bg-background prevent-deselect">
            <Tabs defaultValue="tools" className="flex h-full flex-col">
                <div className="border-b px-4 py-3 bg-muted/10">
                    <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/40 p-1">
                        <TabsTrigger value="template" className="h-8 gap-2 uppercase tracking-tighter font-black text-[10px]">
                            <LayoutTemplate className="h-3 w-3" /> Templates
                        </TabsTrigger>
                        <TabsTrigger value="tools" className="h-8 gap-2 uppercase tracking-tighter font-black text-[10px]">
                            <Settings className="h-3 w-3" /> Tools
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Templates Section */}
                <TabsContent value="template" className="flex-1 p-0 m-0 overflow-hidden">
                    <Tabs defaultValue="F" className="flex h-full flex-col">
                        <div className="px-4 py-2 border-b bg-muted/5">
                            <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/20 p-1">
                                <TabsTrigger value="F" className="text-[10px] h-6 px-0 font-bold">FULL</TabsTrigger>
                                <TabsTrigger value="S" className="text-[10px] h-6 px-0 font-bold">SIDE</TabsTrigger>
                                <TabsTrigger value="T" className="text-[10px] h-6 px-0 font-bold">TOP</TabsTrigger>
                            </TabsList>
                        </div>

                        {(['F', 'S', 'T'] as const).map(cat => (
                            <TabsContent key={cat} value={cat} className="flex-1 m-0">
                                <ScrollArea className="h-[calc(100vh-140px)]">
                                    <div className="p-4 grid grid-cols-2 gap-3 pb-20">
                                        {templateItems[cat].length === 0 && (
                                            <div className="col-span-2 text-center text-muted-foreground p-8 text-xs italic">
                                                No templates in this category
                                            </div>
                                        )}
                                        {templateItems[cat].map((item) => (
                                            <div
                                                key={item.id}
                                                className="aspect-[4/3] rounded-xl bg-muted border border-transparent hover:border-primary/50 cursor-pointer overflow-hidden group relative transition-all shadow-sm hover:shadow-md"
                                                onClick={() => {
                                                    if (window.confirm("Changing templates will reset your current project. Continue?")) {
                                                        initProjectWithTemplate({
                                                            name: item.name,
                                                            svg: item.svg,
                                                            json: item.json,
                                                            category: item.type
                                                        });
                                                    }
                                                }}
                                            >
                                                <img src={item.png} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                    <span className="text-[10px] text-white font-bold px-3 py-1.5 bg-primary/90 rounded-full shadow-lg backdrop-blur-sm">CLICK TO APPLY</span>
                                                </div>
                                                <div className="absolute bottom-1 left-1 px-1.5 bg-black/70 text-[8px] text-white rounded font-mono uppercase tracking-widest backdrop-blur-sm">
                                                    {item.id.split('_')[0]}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        ))}
                    </Tabs>
                </TabsContent>

                {/* Tools Section (Resources) */}
                <TabsContent value="tools" className="flex-1 p-0 m-0 overflow-hidden">
                    <Tabs defaultValue="text" className="flex h-full flex-col">
                        <div className="border-b px-2 py-2 bg-muted/5">
                            <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 bg-transparent p-0">
                                <TabsTrigger value="video" className="flex-1 min-w-[50px] text-[10px] h-8 px-2 font-bold"><FileVideo className="h-3 w-3 mr-1" />VIDEO</TabsTrigger>
                                <TabsTrigger value="image" className="flex-1 min-w-[50px] text-[10px] h-8 px-2 font-bold"><ImageIcon className="h-3 w-3 mr-1" />IMG</TabsTrigger>
                                <TabsTrigger value="audio" className="flex-1 min-w-[50px] text-[10px] h-8 px-2 font-bold"><Music className="h-3 w-3 mr-1" />AUD</TabsTrigger>
                                <TabsTrigger value="text" className="flex-1 min-w-[50px] text-[10px] h-8 px-2 font-bold"><Type className="h-3 w-3 mr-1" />TXT</TabsTrigger>
                                <TabsTrigger value="shape" className="flex-1 min-w-[50px] text-[10px] h-8 px-2 font-bold"><Shapes className="h-3 w-3 mr-1" />SHP</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="video" className="flex-1 p-0 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 grid grid-cols-2 gap-2 pb-20">
                                    {videoItems.length === 0 && <div className="col-span-2 text-center text-muted-foreground p-4">No videos found</div>}
                                    {videoItems.map((item, i) => (
                                        <div
                                            key={i}
                                            className="aspect-video rounded-md bg-muted flex items-center justify-center border cursor-grab hover:border-primary overflow-hidden group relative"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'video', item.src)}
                                        >
                                            {item.thumbnail ? (
                                                <img src={item.thumbnail} className="w-full h-full object-cover pointer-events-none" alt="Thumbnail" />
                                            ) : (
                                                <video src={item.src} className="w-full h-full object-cover pointer-events-none" />
                                            )}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                                DRAG TO ADD
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="image" className="flex-1 p-0 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 grid grid-cols-2 gap-2 pb-20">
                                    {images.length === 0 && <div className="col-span-2 text-center text-muted-foreground p-4">No images found</div>}
                                    {images.map((src, i) => (
                                        <div
                                            key={i}
                                            className="aspect-square rounded-md bg-muted flex items-center justify-center border cursor-grab hover:border-primary overflow-hidden group relative"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'image', src)}
                                        >
                                            <img src={src} className="w-full h-full object-cover pointer-events-none" alt={`Asset ${i}`} />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                                DRAG TO ADD
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="audio" className="flex-1 p-0 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-2 pb-20">
                                    {audios.length === 0 && <div className="text-center text-muted-foreground p-4">No audio files found</div>}
                                    {audios.map((src, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent cursor-grab transition-colors"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'audio', src)}
                                        >
                                            <Music className="h-3 w-3 text-primary" />
                                            <span className="text-[11px] truncate flex-1 font-medium">{src.split('/').pop()}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="text" className="flex-1 p-0 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-2 pb-20">
                                    {fonts.map((font) => (
                                        <div
                                            key={font}
                                            className="rounded-md border p-4 text-center hover:bg-accent cursor-grab transition-all hover:scale-[1.02]"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'text', font)}
                                        >
                                            <h3 className="text-lg" style={{ fontFamily: font }}>{font}</h3>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="shape" className="flex-1 p-0 m-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-4 grid grid-cols-3 gap-2">
                                    {shapeImages.length === 0 && <div className="col-span-3 text-center text-muted-foreground p-4 text-xs">No shape assets found</div>}
                                    {shapeImages.map((src, i) => (
                                        <div
                                            key={`shape-img-${i}`}
                                            className="aspect-square rounded-md border flex items-center justify-center hover:bg-accent cursor-grab p-2 relative group"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'shape', src)}
                                        >
                                            <img src={src} className="w-full h-full object-contain pointer-events-none" alt="Shape" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] text-center font-bold">
                                                DRAG
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Separator className="my-4" />

                                <div className="p-4 space-y-2 pb-20">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Custom SVG Path</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={customSvg}
                                            onChange={(e) => setCustomSvg(e.target.value)}
                                            placeholder="e.g. M10 10 H 90..."
                                            className="text-[10px] font-mono h-8"
                                        />
                                        <Button
                                            size="icon"
                                            className="h-8 w-8"
                                            draggable
                                            onDragStart={(e) => {
                                                if (customSvg.trim()) {
                                                    e.dataTransfer.setData("application/json", JSON.stringify({
                                                        type: 'shape',
                                                        src: 'custom',
                                                        customPath: customSvg
                                                    }))
                                                }
                                            }}
                                        >
                                            <Shapes className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div >
    )
}
