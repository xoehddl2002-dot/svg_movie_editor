'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { loadFont } from "@/utils/fonts"

interface TextTabProps {
    onDragStart: (e: React.DragEvent, type: string, src: string) => void
}

export function TextTab({ onDragStart }: TextTabProps) {
    const [fonts, setFonts] = useState<string[]>([])

    useEffect(() => {
        fetch('/api/fonts')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setFonts(data)
                    // Pre-load fonts for preview
                    data.forEach(font => {
                        loadFont({
                            family: font,
                            url: `/assets/font/${font}.woff`
                        });
                    });
                }
            })
            .catch(err => console.error('Failed to fetch fonts:', err))
    }, [])

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-2 pb-20">
                {fonts.map((font) => (
                    <Card
                        key={font}
                        className="text-center hover:bg-accent cursor-grab transition-all hover:scale-[1.02]"
                        draggable
                        onDragStart={(e) => onDragStart(e, 'text', font)}
                    >
                        <CardContent className="p-4">
                            <h3 className="text-lg" style={{ fontFamily: font }}>{font}</h3>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    )
}
