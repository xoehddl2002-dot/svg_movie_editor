'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Shapes } from "lucide-react"
import { useState } from "react"

// 기본 SVG 도형 정의
const BASIC_SHAPES = [
    {
        name: 'Rectangle',
        path: 'M 0 0 H 100 V 100 H 0 Z',
        viewBox: '0 0 100 100',
    },
    {
        name: 'Circle',
        path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
        viewBox: '0 0 100 100',
    },
    {
        name: 'Triangle',
        path: 'M 50 0 L 100 100 L 0 100 Z',
        viewBox: '0 0 100 100',
    },
    {
        name: 'Heart',
        path: 'M 50 90 L 48 88 C 10 55 0 35 0 20 C 0 10 10 0 25 0 C 35 0 45 10 50 20 C 55 10 65 0 75 0 C 90 0 100 10 100 20 C 100 35 90 55 52 88 L 50 90 Z',
        viewBox: '0 0 100 100',
    },
    {
        name: 'Star',
        path: 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z',
        viewBox: '0 0 100 100',
    },
    {
        name: 'Arrow Right',
        path: 'M 0 20 L 60 20 L 60 0 L 100 50 L 60 100 L 60 80 L 0 80 Z',
        viewBox: '0 0 100 100',
    },
]

interface ShapeTabProps {
    shapeImages: string[]
    onDragStart: (e: React.DragEvent, type: string, src: string) => void
}

export function ShapeTab({ shapeImages, onDragStart }: ShapeTabProps) {
    const [customSvg, setCustomSvg] = useState('')

    return (
        <ScrollArea className="h-full">
            {/* 기본 도형 섹션 */}
            <div className="p-4">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block">Primitives</Label>
                <div className="grid grid-cols-3 gap-2">
                    {BASIC_SHAPES.map((shape) => (
                        <Card
                            key={shape.name}
                            className="aspect-square flex flex-col items-center justify-center hover:bg-accent cursor-grab relative group transition-colors"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData("application/json", JSON.stringify({
                                    type: 'shape',
                                    src: shape.name,
                                }))
                            }}
                        >
                            <CardContent className="p-3 flex flex-col items-center justify-center w-full h-full">
                                <svg viewBox={shape.viewBox} className="w-8 h-8 pointer-events-none">
                                    <path d={shape.path} fill="currentColor" />
                                </svg>
                                <span className="text-[8px] text-muted-foreground mt-1 font-medium">{shape.name}</span>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] text-center font-bold rounded-md">
                                    DRAG
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Separator className="my-2" />

            {/* 아이콘 섹션 (API에서 로드) */}
            <div className="p-4">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block">Icons</Label>
                <div className="grid grid-cols-3 gap-2">
                    {shapeImages.length === 0 && <div className="col-span-3 text-center text-muted-foreground p-4 text-xs">No icons found</div>}
                    {shapeImages.map((src, i) => (
                        <Card
                            key={`icon-${i}`}
                            className="aspect-square flex items-center justify-center hover:bg-accent cursor-grab relative group transition-colors"
                            draggable
                            onDragStart={(e) => onDragStart(e, 'icon', src)}
                        >
                            <CardContent className="p-2 w-full h-full flex items-center justify-center">
                                <img src={src} className="w-full h-full object-contain pointer-events-none" alt="Icon" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] text-center font-bold rounded-md">
                                    DRAG
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Separator className="my-2" />

            {/* 커스텀 SVG Path 섹션 */}
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
                                // Calculate viewBox for custom path
                                const div = document.createElement('div')
                                div.innerHTML = `<svg><path d="${customSvg}"/></svg>`
                                const path = div.querySelector('path')
                                let viewBox = '0 0 100 100' // Default fallback

                                if (path) {
                                    // We need to append to body to measure
                                    div.style.position = 'absolute'
                                    div.style.visibility = 'hidden'
                                    document.body.appendChild(div)
                                    try {
                                        const bbox = path.getBBox()
                                        // Add some padding or just use exact bbox
                                        viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
                                    } catch (err) {
                                        console.warn('Failed to measure custom path bbox', err)
                                    } finally {
                                        document.body.removeChild(div)
                                    }
                                }

                                e.dataTransfer.setData("application/json", JSON.stringify({
                                    type: 'shape',
                                    src: 'custom',
                                    customPath: customSvg,
                                    viewBox: viewBox
                                }))
                            }
                        }}
                    >
                        <Shapes className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </ScrollArea>
    )
}
