import { useState, useMemo, useEffect } from "react"
import { Loader2, Sparkles, History } from "lucide-react"
import { useStore, type Clip } from "@/features/editor/store/useStore"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function AIMagicEditModal() {
    const { initProjectWithTemplate, setProjectState, aiTemplateHistory, addAITemplateHistory, setAITemplateHistory } = useStore()
    const [prompt, setPrompt] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(false)
    const [templateType, setTemplateType] = useState<'full' | 'side' | 'top'>('full')
    const [previewTemplate, setPreviewTemplate] = useState<{svg: string, json: any, type: string} | null>(null)

    useEffect(() => {
        if (open) {
            fetch('/api/ai/history')
                .then(res => res.json())
                .then(data => {
                    if (data.history) {
                        setAITemplateHistory(data.history)
                    }
                })
                .catch(err => console.error("Failed to fetch AI history:", err))
        }
    }, [open, setAITemplateHistory])

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);

        try {
            // Send empty context for now, or you could stringify the current tracks 
            const currentSvgData = ""; 

            const res = await fetch('/api/ai/edit-svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentSvgData, prompt, type: templateType })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate Template');
            }

            if (data.result && data.result.svg && data.result.json) {
                setPreviewTemplate({ ...data.result, type: templateType });
                
                // Save to physical file
                try {
                    const saveRes = await fetch('/api/ai/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt,
                            type: templateType,
                            svg: data.result.svg,
                            json: data.result.json
                        })
                    });
                    const saveData = await saveRes.json();
                    if (saveData.item) {
                        addAITemplateHistory(saveData.item);
                    }
                } catch (saveErr) {
                    console.error("Failed to save AI history:", saveErr);
                }
            } else {
                throw new Error("Invalid response format from AI.");
            }

        } catch (err: any) {
            console.error("AI Generation failed:", err);
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    }

    const handleLoadProject = async () => {
        if (!previewTemplate) return;
        
        try {
            // Construct a TemplateData object
            const svgContent = previewTemplate.svg;
            const encodedSvg = encodeURIComponent(svgContent);
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

            const typeMap: Record<string, string> = { full: 'F', side: 'S', top: 'T' };
            
            await initProjectWithTemplate({
                name: "AI Generated Template",
                svg: dataUrl,
                json: previewTemplate.json,
                category: typeMap[previewTemplate.type] || 'F'
            });
            
            setPrompt("");
            setPreviewTemplate(null);
            setOpen(false);
        } catch (e) {
            console.error("Failed to load generated template", e);
            alert("Failed to load generated template. See console for details.");
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setPrompt("");
            setError(null);
            setPreviewTemplate(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button
                    onClick={(e) => {
                        // Ensure button doesn't trigger parent click events
                        e.stopPropagation();
                    }}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-emerald-500/50 bg-transparent shadow-sm hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50 h-8 px-3 gap-2"
                    title="Generate or edit SVG shapes with AI"
                >
                    <Sparkles className="h-4 w-4" />
                    AI Magic
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-5 w-5" />
                        AI Template Generator
                    </DialogTitle>
                    <DialogDescription>
                        {previewTemplate 
                            ? "Review your newly generated template before loading it."
                            : "Describe the entire SVG composition or template you want to create."}
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
                            <div className="flex gap-2 mb-2">
                                {(["full", "side", "top"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTemplateType(t)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                            templateType === t 
                                                ? "bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-400 dark:text-emerald-300"
                                                : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80"
                                        }`}
                                    >
                                        {t.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded border border-emerald-200 dark:border-emerald-800 leading-relaxed mt-0">
                                ✨ <strong>Pro Tip:</strong> Be as descriptive as possible. Instead of "a star", try "a glowing golden star over a dark night sky background with 3 text fields for titles".
                            </div>
                            <textarea
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px] resize-none"
                                placeholder="e.g. A vibrant summer beach scene with a 'Summer Vacation' title text in the center and some palm trees."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isGenerating}
                                autoFocus
                            />
                            
                            {error && (
                                <div className="text-xs text-red-500 font-medium bg-red-500/10 p-2 rounded border border-red-500/20">
                                    {error}
                                </div>
                            )}

                            {aiTemplateHistory.length > 0 && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="flex flex-col gap-2">
                                        <Label className="flex items-center gap-2 text-muted-foreground mb-1">
                                            <History className="h-4 w-4" />
                                            Recent Generations
                                        </Label>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                                            {aiTemplateHistory.map((hist) => (
                                                <button
                                                    key={hist.id}
                                                    onClick={() => {
                                                        setPrompt(hist.prompt);
                                                        setTemplateType(hist.type || 'full');
                                                        setPreviewTemplate({ svg: hist.svg, json: hist.json, type: hist.type || 'full' });
                                                    }}
                                                    className="w-full text-left bg-muted/30 hover:bg-muted p-3 rounded-md transition-colors border border-transparent hover:border-border text-sm flex flex-col gap-1.5 inline-flex"
                                                >
                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                        <span className="font-medium line-clamp-1 text-foreground break-words flex-1">{hist.prompt}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase shrink-0">
                                                            {hist.type || 'full'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{new Date(hist.date).toLocaleString()}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
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
                                onClick={handleLoadProject} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                            >
                                Load Project
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isGenerating}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isGenerating || !prompt.trim()}
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
    )
}
