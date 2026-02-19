'use client'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/features/editor/store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutTemplate, Search, Info, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function TemplateSelector() {
    const router = useRouter()
    const { initProjectWithTemplate, setProjectState } = useStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    interface TemplateItem {
        id: string
        type: 'F' | 'S' | 'T'
        name: string
        png: string
        svg: string
        json: string
    }

    const [templateItems, setTemplateItems] = useState<{ F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] }>({ F: [], S: [], T: [] })
    const [search, setSearch] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Load templates from API
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
            } finally {
                setIsLoading(false)
            }
        }

        loadTemplates()
    }, [])

    const filteredTemplates = (items: TemplateItem[]) =>
        items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))

    const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string
                const data = JSON.parse(content)

                // Basic validation
                if (data.tracks && typeof data.duration === 'number') {
                    setProjectState({
                        tracks: data.tracks,
                        duration: data.duration,
                        aspectRatio: data.aspectRatio || (16 / 9),
                        currentTime: data.currentTime || 0,
                        selectedClipId: null
                    })
                    router.push('/editor') // Navigate to editor
                    alert('Project loaded successfully!')
                } else {
                    alert('Invalid project file format')
                }
            } catch (err) {
                console.error('Failed to parse project file', err)
                alert('Failed to load project file')
            }
        }
        reader.readAsText(file)

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleTemplateSelect = async (template: TemplateItem) => {
        await initProjectWithTemplate({
            name: template.name,
            svg: template.svg,
            json: template.json,
            category: template.type
        })
        router.push('/editor')
    }

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col p-6 lg:p-12 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <LayoutTemplate className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter">Midnight SVG Edit</h1>
                    </div>
                    <p className="text-muted-foreground text-lg max-w-xl">
                        Select a premium template to start your dynamic SVG composition.
                        Every element can be edited in the next step.
                    </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <Input
                        type="file"
                        accept=".json"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleLoadProject}
                    />
                    <Button
                        variant="outline"
                        size="lg"
                        className="gap-2 flex-1 md:flex-initial"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-5 w-5" />
                        Load Project
                    </Button>

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            className="pl-9 h-full bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Template Selection Tabs */}
            <Tabs defaultValue="F" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-fit h-12 bg-muted/40 p-1 mb-8">
                    <TabsTrigger value="F" className="px-8 h-10 text-sm font-semibold">Full (16:9)</TabsTrigger>
                    <TabsTrigger value="S" className="px-8 h-10 text-sm font-semibold">Side (Slim)</TabsTrigger>
                    <TabsTrigger value="T" className="px-8 h-10 text-sm font-semibold">Top (Wide)</TabsTrigger>
                </TabsList>

                {(['F', 'S', 'T'] as const).map(cat => (
                    <TabsContent key={cat} value={cat} className="flex-1 overflow-hidden m-0">
                        <ScrollArea className="h-full pr-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-12">
                                {isLoading ? (
                                    <div className="col-span-full py-20 text-center">
                                        <p className="text-muted-foreground font-medium">Loading templates...</p>
                                    </div>
                                ) : filteredTemplates(templateItems[cat]).length === 0 ? (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl">
                                        <Info className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground font-medium">No templates found in this category.</p>
                                    </div>
                                ) : (
                                    filteredTemplates(templateItems[cat]).map((template) => (
                                        <div
                                            key={template.id}
                                            className="group relative bg-muted/30 rounded-[2rem] overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
                                            onClick={() => handleTemplateSelect(template)}
                                        >
                                            {/* Aspect Ratio Container */}
                                            <div className={cat === 'S' ? 'aspect-[3/4]' : 'aspect-video'}>
                                                <img
                                                    src={template.png}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                    alt={template.name}
                                                />
                                            </div>

                                            {/* Overlay Info */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                                <p className="text-white text-xs font-mono mb-1 uppercase tracking-wider">{template.id.split('_')[0]}</p>
                                                <h3 className="text-white font-bold truncate">{template.name}</h3>
                                                <div className="mt-4 bg-primary text-primary-foreground text-[10px] font-bold py-2 px-4 rounded-full w-fit">
                                                    START EDITING
                                                </div>
                                            </div>

                                            {/* Static Label */}
                                            <div className="p-4 flex justify-between items-center group-hover:opacity-0 transition-opacity">
                                                <h3 className="text-sm font-semibold truncate flex-1">{template.name}</h3>
                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                                                    {cat === 'F' ? 'FHD' : cat === 'S' ? 'Side' : 'Wide'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                ))}
            </Tabs>

            {/* Footer / Branding */}
            <div className="pt-6 border-t flex justify-between items-center text-[10px] text-muted-foreground">
                <p>© 2026 Midnight Opportunity. SVG Precision Engine v1.0</p>
                <div className="flex gap-4">
                    <span>GPU ACCELERATED</span>
                    <span>REAL-TIME SVG</span>
                </div>
            </div>
        </div>
    )
}
