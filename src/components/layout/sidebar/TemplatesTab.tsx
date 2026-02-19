'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"
import { useStore } from "@/features/editor/store/useStore"

interface TemplateItem {
    id: string
    type: 'F' | 'S' | 'T'
    name: string
    png: string
    svg: string
    json: string
}

export function TemplatesTab() {
    const { initProjectWithTemplate } = useStore()
    const [templateItems, setTemplateItems] = useState<{ F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] }>({ F: [], S: [], T: [] })

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

    return (
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
    )
}
