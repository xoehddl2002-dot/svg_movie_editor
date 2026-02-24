'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"

interface ImageTabProps {
    images: string[]
    onDragStart: (e: React.DragEvent, type: string, src: string, mediaType?: 'video' | 'image') => void
}

export function ImageTab({ images, onDragStart }: ImageTabProps) {
    return (
        <ScrollArea className="h-full">
            <div className="p-4 grid grid-cols-2 gap-2 pb-20">
                {images.length === 0 && <div className="col-span-2 text-center text-muted-foreground p-4">No images found</div>}
                {images.map((src, i) => (
                    <Card
                        key={i}
                        className="overflow-hidden cursor-grab hover:border-primary group relative"
                        draggable
                        onDragStart={(e) => onDragStart(e, 'mask', src, 'image')}
                    >
                        <CardContent className="p-0 aspect-square relative bg-muted flex items-center justify-center">
                            <img src={src} className="w-full h-full object-cover pointer-events-none" alt={`Asset ${i}`} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                DRAG TO ADD
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    )
}
