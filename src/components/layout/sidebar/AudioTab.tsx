'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Music } from "lucide-react"

interface AudioTabProps {
    audios: string[]
    onDragStart: (e: React.DragEvent, type: string, src: string) => void
}

export function AudioTab({ audios, onDragStart }: AudioTabProps) {
    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-2 pb-20">
                {audios.length === 0 && <div className="text-center text-muted-foreground p-4">No audio files found</div>}
                {audios.map((src, i) => (
                    <Card
                        key={i}
                        className="cursor-grab hover:bg-accent transition-colors"
                        draggable
                        onDragStart={(e) => onDragStart(e, 'audio', src)}
                    >
                        <CardContent className="p-3 flex items-center gap-2">
                            <Music className="h-3 w-3 text-primary" />
                            <span className="text-[11px] truncate flex-1 font-medium">{src.split('/').pop()}</span>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    )
}
