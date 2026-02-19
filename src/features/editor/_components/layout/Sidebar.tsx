'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Type, Image as ImageIcon, FileVideo, Shapes, Music, LayoutTemplate, Settings } from "lucide-react"
import { useState, useEffect } from "react"
import { useStore } from "@/features/editor/store/useStore"

import { TemplatesTab } from "./sidebar/TemplatesTab"
import { VideoTab } from "./sidebar/VideoTab"
import { ImageTab } from "./sidebar/ImageTab"
import { AudioTab } from "./sidebar/AudioTab"
import { TextTab } from "./sidebar/TextTab"
import { ShapeTab } from "./sidebar/ShapeTab"
import { ClipProperties } from "./sidebar/ClipProperties"

export function Sidebar() {
    const { tracks, selectedClipId } = useStore()

    const [videoItems, setVideoItems] = useState<{ src: string, thumbnail?: string }[]>([])
    const [images, setImages] = useState<string[]>([])
    const [shapeImages, setShapeImages] = useState<string[]>([])
    const [audios, setAudios] = useState<string[]>([])

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

    const handleDragStart = (e: React.DragEvent, type: string, src: string, mediaType?: 'video' | 'image') => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type, src, mediaType }))
    }

    const selectedClip = selectedClipId
        ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
        : null

    if (selectedClip && selectedClip.attr_rock !== true) {
        return (
            <div className="flex h-full w-80 flex-col border-r bg-background prevent-deselect">
                <ScrollArea className="h-full">
                    <ClipProperties clip={selectedClip} />
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
                    <TemplatesTab />
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
                            <VideoTab videoItems={videoItems} onDragStart={handleDragStart} />
                        </TabsContent>

                        <TabsContent value="image" className="flex-1 p-0 m-0 overflow-hidden">
                            <ImageTab images={images} onDragStart={handleDragStart} />
                        </TabsContent>

                        <TabsContent value="audio" className="flex-1 p-0 m-0 overflow-hidden">
                            <AudioTab audios={audios} onDragStart={handleDragStart} />
                        </TabsContent>

                        <TabsContent value="text" className="flex-1 p-0 m-0 overflow-hidden">
                            <TextTab onDragStart={handleDragStart} />
                        </TabsContent>

                        <TabsContent value="shape" className="flex-1 p-0 m-0 overflow-hidden">
                            <ShapeTab shapeImages={shapeImages} onDragStart={handleDragStart} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div >
    )
}
