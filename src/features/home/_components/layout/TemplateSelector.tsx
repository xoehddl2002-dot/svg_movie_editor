'use client'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useStore, type AITemplateHistoryItem } from "@/features/editor/store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutTemplate, Search, Info, Upload, Sparkles, Plus, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// 프리셋 템플릿 타입 정의
interface TemplateItem {
    id: string
    type: 'F' | 'S' | 'T'
    name: string
    png: string
    svg: string
    json: string
}

export function TemplateSelector() {
    const router = useRouter()
    const { initProjectWithTemplate, setProjectState } = useStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 최상위 섹션 상태 (프리셋 vs AI)
    const [activeSection, setActiveSection] = useState<'preset' | 'ai'>('preset')

    // 프리셋 템플릿 상태
    const [templateItems, setTemplateItems] = useState<{ F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] }>({ F: [], S: [], T: [] })
    const [search, setSearch] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    // AI 템플릿 히스토리 상태
    const [aiHistory, setAiHistory] = useState<AITemplateHistoryItem[]>([])
    const [isAiLoading, setIsAiLoading] = useState(false)

    // AI 생성 모달 상태
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showImageToSvgModal, setShowImageToSvgModal] = useState(false)
    const [aiPrompt, setAiPrompt] = useState("")
    const [aiTemplateType, setAiTemplateType] = useState<'full' | 'side' | 'top'>('full')
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [imageToSvgType, setImageToSvgType] = useState<'full' | 'side' | 'top'>('full')
    const [imageToSvgPrompt, setImageToSvgPrompt] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [generateError, setGenerateError] = useState<string | null>(null)
    const [previewTemplate, setPreviewTemplate] = useState<{ svg: string, json: any, type: string } | null>(null)

    // 프리셋 템플릿 로드
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const response = await fetch('/api/templates')
                if (!response.ok) throw new Error('Failed to fetch templates')
                const templates: TemplateItem[] = await response.json()
                const categorized: { F: TemplateItem[], S: TemplateItem[], T: TemplateItem[] } = { F: [], S: [], T: [] }
                templates.forEach(item => { categorized[item.type].push(item) })
                setTemplateItems(categorized)
            } catch (error) {
                console.error('Failed to load templates:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadTemplates()
    }, [])

    // AI 히스토리 로드 (AI 섹션 활성화 시)
    useEffect(() => {
        if (activeSection === 'ai') {
            setIsAiLoading(true)
            fetch('/api/ai/history')
                .then(res => res.json())
                .then(data => {
                    if (data.history) setAiHistory(data.history)
                })
                .catch(err => console.error("Failed to fetch AI history:", err))
                .finally(() => setIsAiLoading(false))
        }
    }, [activeSection])

    // 검색 필터
    const filteredTemplates = (items: TemplateItem[]) =>
        items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))

    // AI 히스토리를 타입별로 분류
    const categorizedAiHistory = {
        full: aiHistory.filter(h => (h.type || 'full') === 'full'),
        side: aiHistory.filter(h => h.type === 'side'),
        top: aiHistory.filter(h => h.type === 'top'),
    }

    // AI 히스토리 검색 필터
    const filteredAiHistory = (items: AITemplateHistoryItem[]) =>
        items.filter(item => item.prompt.toLowerCase().includes(search.toLowerCase()))

    // 프로젝트 파일 로드
    const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string
                const data = JSON.parse(content)
                if (data.tracks && typeof data.duration === 'number') {
                    setProjectState({
                        tracks: data.tracks,
                        duration: data.duration,
                        aspectRatio: data.aspectRatio || (16 / 9),
                        currentTime: data.currentTime || 0,
                        selectedClipId: null
                    })
                    router.push('/editor')
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
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // 프리셋 템플릿 선택 핸들러
    const handleTemplateSelect = async (template: TemplateItem) => {
        await initProjectWithTemplate({
            name: template.name,
            svg: template.svg,
            json: template.json,
            category: template.type
        })
        router.push('/editor')
    }

    // AI 히스토리 아이템 선택 → 에디터 이동
    const handleAITemplateSelect = async (hist: AITemplateHistoryItem) => {
        try {
            const encodedSvg = encodeURIComponent(hist.svg)
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`
            const typeMap: Record<string, string> = { full: 'F', side: 'S', top: 'T' }
            await initProjectWithTemplate({
                name: hist.prompt.slice(0, 30),
                svg: dataUrl,
                json: hist.json,
                category: typeMap[hist.type] || 'F'
            })
            router.push('/editor')
        } catch (e) {
            console.error("Failed to load AI template", e)
            alert("Failed to load AI template.")
        }
    }

    // AI 템플릿 생성 핸들러
    const handleGenerate = async () => {
        if (!aiPrompt.trim()) return
        setIsGenerating(true)
        setGenerateError(null)

        try {
            const res = await fetch('/api/ai/edit-svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentSvgData: "", prompt: aiPrompt, type: aiTemplateType })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to generate Template')

            if (data.result?.svg && data.result?.json) {
                setPreviewTemplate({ ...data.result, type: aiTemplateType })
                // 히스토리에 저장
                try {
                    const saveRes = await fetch('/api/ai/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: aiPrompt, type: aiTemplateType, svg: data.result.svg, json: data.result.json })
                    })
                    const saveData = await saveRes.json()
                    if (saveData.item) {
                        setAiHistory(prev => [saveData.item, ...prev])
                    }
                } catch (saveErr) {
                    console.error("Failed to save AI history:", saveErr)
                }
            } else {
                throw new Error("Invalid response format from AI.")
            }
        } catch (err: any) {
            console.error("AI Generation failed:", err)
            setGenerateError(err.message)
        } finally {
            setIsGenerating(false)
        }
    }

    // AI 이미지-to-SVG 템플릿 생성 핸들러
    const handleImageToSvgGenerate = async () => {
        if (!imagePreviewUrl) return
        setIsGenerating(true)
        setGenerateError(null)

        try {
            const res = await fetch('/api/ai/image-to-svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: imageToSvgPrompt, base64Image: imagePreviewUrl, type: imageToSvgType })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to generate Template from Image')

            if (data.result?.svg && data.result?.json) {
                // Set the correct type for the preview
                setPreviewTemplate({ ...data.result, type: imageToSvgType })
                // 히스토리에 저장
                try {
                    const saveRes = await fetch('/api/ai/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: imageToSvgPrompt || "Image to Template", type: imageToSvgType, svg: data.result.svg, json: data.result.json })
                    })
                    const saveData = await saveRes.json()
                    if (saveData.item) {
                        setAiHistory(prev => [saveData.item, ...prev])
                    }
                } catch (saveErr) {
                    console.error("Failed to save AI history:", saveErr)
                }
            } else {
                throw new Error("Invalid response format from AI.")
            }
        } catch (err: any) {
            console.error("Image to SVG Generation failed:", err)
            setGenerateError(err.message)
        } finally {
            setIsGenerating(false)
        }
    }

    // 이미지 업로드 핸들러
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    // 생성된 프리뷰 → 에디터 로드
    const handleLoadPreview = async () => {
        if (!previewTemplate) return
        try {
            const encodedSvg = encodeURIComponent(previewTemplate.svg)
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`
            const typeMap: Record<string, string> = { full: 'F', side: 'S', top: 'T' }
            await initProjectWithTemplate({
                name: "AI Generated Template",
                svg: dataUrl,
                json: previewTemplate.json,
                category: typeMap[previewTemplate.type] || 'F'
            })
            setShowCreateModal(false)
            setAiPrompt("")
            setPreviewTemplate(null)
            router.push('/editor')
        } catch (e) {
            console.error("Failed to load generated template", e)
            alert("Failed to load generated template.")
        }
    }

    // 모달 닫기 초기화
    const handleModalClose = (open: boolean) => {
        setShowCreateModal(open)
        if (!open) {
            setAiPrompt("")
            setGenerateError(null)
            setPreviewTemplate(null)
        }
    }

    const handleImageToSvgModalClose = (open: boolean) => {
        setShowImageToSvgModal(open)
        if (!open) {
            setAiPrompt("")
            setGenerateError(null)
            setPreviewTemplate(null)
            setImagePreviewUrl(null)
        }
    }

    // ─── 렌더링 헬퍼: 프리셋 카드 ───
    const renderPresetCard = (template: TemplateItem, cat: string) => (
        <div
            key={template.id}
            className="group relative bg-muted/30 rounded-[2rem] overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
            onClick={() => handleTemplateSelect(template)}
        >
            <div className={'aspect-video'}>
                <img
                    src={template.png}
                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
                    alt={template.name}
                />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-white text-xs font-mono mb-1 uppercase tracking-wider">{template.id.split('_')[0]}</p>
                <h3 className="text-white font-bold truncate">{template.name}</h3>
                <div className="mt-4 bg-primary text-primary-foreground text-[10px] font-bold py-2 px-4 rounded-full w-fit">
                    START EDITING
                </div>
            </div>
            <div className="p-4 flex justify-between items-center group-hover:opacity-0 transition-opacity">
                <h3 className="text-sm font-semibold truncate flex-1">{template.name}</h3>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                    {cat === 'F' ? 'FHD' : cat === 'S' ? 'Side' : 'Wide'}
                </span>
            </div>
        </div>
    )

    // ─── 렌더링 헬퍼: AI 카드 ───
    const renderAICard = (hist: AITemplateHistoryItem) => (
        <div
            key={hist.id}
            className="group relative bg-muted/30 rounded-[2rem] overflow-hidden border-2 border-transparent hover:border-emerald-500 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
            onClick={() => handleAITemplateSelect(hist)}
        >
            {/* SVG 인라인 프리뷰 */}
            <div className={'aspect-video'}>
                <div
                    className="w-full h-full bg-black/5 [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: hist.svg }}
                />
            </div>
            {/* 호버 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-emerald-300 text-xs font-mono mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Generated
                </p>
                <h3 className="text-white font-bold line-clamp-2 text-sm">{hist.prompt || 'Image to Template'}</h3>
                <p className="text-white/60 text-[10px] mt-1">{new Date(hist.date).toLocaleDateString()}</p>
                <div className="mt-3 bg-emerald-600 text-white text-[10px] font-bold py-2 px-4 rounded-full w-fit">
                    START EDITING
                </div>
            </div>
            {/* 고정 라벨 */}
            <div className="p-4 flex justify-between items-center group-hover:opacity-0 transition-opacity">
                <h3 className="text-sm font-semibold truncate flex-1">{hist.prompt || 'Image to Template'}</h3>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded uppercase">
                    {hist.type || 'full'}
                </span>
            </div>
        </div>
    )

    // ─── 렌더링 헬퍼: 새로 만들기 카드 ───
    const renderCreateNewCard = () => (
        <div
            className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-[2rem] overflow-hidden border-2 border-dashed border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 flex items-center justify-center"
            onClick={() => setShowCreateModal(true)}
        >
            <div className="aspect-video flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Plus className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Text to Template</p>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">글로 새 템플릿 생성</p>
                </div>
            </div>
        </div>
    )

    const renderImageToSvgCard = () => (
        <div
            className="group relative bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-[2rem] overflow-hidden border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 flex items-center justify-center"
            onClick={() => setShowImageToSvgModal(true)}
        >
            <div className="aspect-video flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Image to Template</p>
                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">이미지로 템플릿 생성</p>
                </div>
            </div>
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col p-6 lg:p-12 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
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

            {/* ─── 최상위 섹션 탭 ─── */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveSection('preset')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeSection === 'preset'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4" />
                        Templates
                    </span>
                </button>
                <button
                    onClick={() => setActiveSection('ai')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeSection === 'ai'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Templates
                    </span>
                </button>
            </div>

            {/* ─── 프리셋 템플릿 섹션 ─── */}
            {activeSection === 'preset' && (
                <Tabs defaultValue="F" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="w-fit h-12 bg-muted/40 p-1 mb-6">
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
                                        filteredTemplates(templateItems[cat]).map((template) => renderPresetCard(template, cat))
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* ─── AI 템플릿 섹션 ─── */}
            {activeSection === 'ai' && (
                <Tabs defaultValue="full" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="w-fit h-12 bg-emerald-100/50 dark:bg-emerald-950/30 p-1 mb-6">
                        <TabsTrigger value="full" className="px-8 h-10 text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Full (16:9)</TabsTrigger>
                        <TabsTrigger value="side" className="px-8 h-10 text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Side (Slim)</TabsTrigger>
                        <TabsTrigger value="top" className="px-8 h-10 text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Top (Wide)</TabsTrigger>
                    </TabsList>

                    {(['full', 'side', 'top'] as const).map(cat => (
                        <TabsContent key={cat} value={cat} className="flex-1 overflow-hidden m-0">
                            <ScrollArea className="h-full pr-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-12">
                                    {/* 새로 만들기 카드 (항상 첫번째) */}
                                    {renderCreateNewCard()}
                                    {renderImageToSvgCard()}

                                    {isAiLoading ? (
                                        <div className="col-span-full py-20 text-center">
                                            <Loader2 className="h-6 w-6 mx-auto animate-spin text-emerald-500 mb-3" />
                                            <p className="text-muted-foreground font-medium">Loading AI templates...</p>
                                        </div>
                                    ) : filteredAiHistory(categorizedAiHistory[cat]).length === 0 ? (
                                        <div className="col-span-3 py-16 text-center border-2 border-dashed border-emerald-200 dark:border-emerald-800 rounded-3xl">
                                            <Sparkles className="h-10 w-10 mx-auto text-emerald-400/50 mb-4" />
                                            <p className="text-muted-foreground font-medium">No AI templates yet.</p>
                                            <p className="text-muted-foreground/60 text-sm mt-1">Create your first one!</p>
                                        </div>
                                    ) : (
                                        filteredAiHistory(categorizedAiHistory[cat]).map((hist) => renderAICard(hist))
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Footer / Branding */}
            <div className="pt-6 border-t flex justify-between items-center text-[10px] text-muted-foreground">
                <p>© 2026 Midnight Opportunity. SVG Precision Engine v1.0</p>
                <div className="flex gap-4">
                    <span>GPU ACCELERATED</span>
                    <span>REAL-TIME SVG</span>
                </div>
            </div>

            {/* ─── AI 생성 모달 ─── */}
            <Dialog open={showCreateModal} onOpenChange={handleModalClose}>
                <DialogContent className="sm:max-w-[700px] w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="h-5 w-5" />
                            AI Template Generator
                        </DialogTitle>
                        <DialogDescription>
                            {previewTemplate
                                ? "생성된 템플릿을 확인하고 프로젝트에 로드하세요."
                                : "원하는 SVG 구성을 자유롭게 설명해주세요."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {previewTemplate ? (
                            <div className="flex flex-col gap-4">
                                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Preview</p>
                                    <div className="aspect-video w-full bg-black rounded overflow-hidden flex items-center justify-center shadow-inner relative">
                                        <div
                                            className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                                            dangerouslySetInnerHTML={{ __html: previewTemplate.svg }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-md text-sm">
                                    <p><strong>Warning:</strong> Loading this template will <b>replace your entire current timeline</b>.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* 타입 선택 */}
                                <div className="flex gap-2 mb-2">
                                    {(["full", "side", "top"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setAiTemplateType(t)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                aiTemplateType === t
                                                    ? "bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-400 dark:text-emerald-300"
                                                    : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80"
                                            }`}
                                        >
                                            {t.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                {/* 팁 */}
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded border border-emerald-200 dark:border-emerald-800 leading-relaxed">
                                    ✨ <strong>Pro Tip:</strong> Be as descriptive as possible. Instead of "a star", try "a glowing golden star over a dark night sky background with 3 text fields for titles".
                                </div>
                                {/* 프롬프트 입력 */}
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px] resize-none"
                                    placeholder="e.g. 도심을 떠나 자연 속 프라이빗한 휴식 공간을 표현하는 템플릿..."
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    disabled={isGenerating}
                                    autoFocus
                                />
                                {generateError && (
                                    <div className="text-xs text-red-500 font-medium bg-red-500/10 p-2 rounded border border-red-500/20">
                                        {generateError}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        {previewTemplate ? (
                            <>
                                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                                    Discard & Try Again
                                </Button>
                                <Button
                                    onClick={handleLoadPreview}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                                >
                                    Load Project
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => handleModalClose(false)} disabled={isGenerating}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !aiPrompt.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            Generate Template
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── AI Image-to-SVG 모달 ─── */}
            <Dialog open={showImageToSvgModal} onOpenChange={handleImageToSvgModalClose}>
                <DialogContent className="sm:max-w-[700px] w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                            <Upload className="h-5 w-5" />
                            Image to Template
                        </DialogTitle>
                        <DialogDescription>
                            {previewTemplate
                                ? "생성된 템플릿을 확인하고 프로젝트에 로드하세요."
                                : "레퍼런스 이미지를 업로드하면 편집 가능한 템플릿으로 변환해 드립니다."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {previewTemplate ? (
                            <div className="flex flex-col gap-4">
                                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Preview</p>
                                    <div className="aspect-video w-full bg-black rounded overflow-hidden flex items-center justify-center shadow-inner relative">
                                        <div
                                            className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                                            dangerouslySetInnerHTML={{ __html: previewTemplate.svg }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* 이미지 업로드 영역 */}
                                <div className="w-full p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/30 relative">
                                    <Input 
                                        type="file" 
                                        accept="image/*" 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                        onChange={handleImageUpload}
                                    />
                                    {imagePreviewUrl ? (
                                        <div className="relative w-full aspect-video flex items-center justify-center rounded-lg overflow-hidden bg-black/5">
                                            <img src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center pointer-events-none">
                                            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                                            <p className="text-sm font-medium">Click or drag image here</p>
                                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                                        </div>
                                    )}
                                </div>

                                {/* 팁 */}
                                <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 p-3 rounded border border-blue-200 dark:border-blue-800 leading-relaxed">
                                    ✨ <strong>Pro Tip:</strong> 복잡한 풍경보다는 UI 화면 캡처, 포스터, 베너 형태의 이미지가 템플릿으로 변환하기 좋습니다.
                                </div>

                                {/* 템플릿 타입 선택 */}
                                <div className="flex gap-2 mb-2">
                                    {(["full", "side", "top"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setImageToSvgType(t)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                imageToSvgType === t
                                                    ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:border-blue-400 dark:text-blue-300"
                                                    : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80"
                                            }`}
                                        >
                                            {t.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                {/* 프롬프트 입력 (옵션) */}
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                                    placeholder="추가 요청사항 (선택) e.g. '버튼 요소들은 모두 둥근 모서리로 처리해줘'"
                                    value={imageToSvgPrompt}
                                    onChange={(e) => setImageToSvgPrompt(e.target.value)}
                                    disabled={isGenerating}
                                />
                                {generateError && (
                                    <div className="text-xs text-red-500 font-medium bg-red-500/10 p-2 rounded border border-red-500/20">
                                        {generateError}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        {previewTemplate ? (
                            <>
                                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                                    Discard & Try Again
                                </Button>
                                <Button
                                    onClick={handleLoadPreview}
                                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                                >
                                    Load Project
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => handleImageToSvgModalClose(false)} disabled={isGenerating}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImageToSvgGenerate}
                                    disabled={isGenerating || !imagePreviewUrl}
                                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            Generate
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
