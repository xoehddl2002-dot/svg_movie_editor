import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { List, Trash2, Play, Download } from "lucide-react"
import { getExportedProjects, SavedProject, deleteExportedProject, clearExportedProjects } from '@/features/editor/utils/projectAutoSave'
import { useStore } from '@/features/editor/store/useStore'

interface ExportedResultsModalProps {
    inHomeContext?: boolean;
}

export function ExportedResultsModal({ inHomeContext }: ExportedResultsModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
    const { setProjectState } = useStore()
    const router = useRouter()
    const pathname = usePathname()

    const loadProjects = async () => {
        const projects = await getExportedProjects()
        setSavedProjects(projects)
    }

    // Fetch projects when modal opens
    useEffect(() => {
        if (isOpen) {
            loadProjects()
        }
    }, [isOpen])

    const handleLoad = (project: SavedProject) => {
        setProjectState({
            tracks: project.tracks,
            duration: project.duration,
            aspectRatio: project.aspectRatio || (16 / 9),
            projectWidth: project.projectWidth || 1920,
            projectHeight: project.projectHeight || 1080,
            currentTime: project.currentTime || 0,
            selectedClipId: null
        })
        setIsOpen(false)
        if (pathname !== '/editor') {
            router.push('/editor')
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this result?')) {
            await deleteExportedProject(id)
            loadProjects()
        }
    }

    const handleClearAll = async () => {
        if (confirm('Are you sure you want to clear all results? This cannot be undone.')) {
            await clearExportedProjects()
            setSavedProjects([])
        }
    }

    const handleDownloadMedia = (project: SavedProject) => {
        if (!project.resultData || !project.resultType) return

        let url = ''
        if (typeof project.resultData === 'string') {
            url = project.resultData
        } else if (project.resultData instanceof Blob) {
            url = URL.createObjectURL(project.resultData)
        }

        if (url) {
            const link = document.createElement('a')
            link.download = `exported-result-${project.timestamp}.${project.resultType}`
            link.href = url
            link.click()
            
            if (project.resultData instanceof Blob) {
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            }
        }
    }

    const renderPreview = (project: SavedProject) => {
        if (!project.resultData || !project.resultType) {
            return <div className="w-16 h-16 bg-muted flex items-center justify-center rounded text-xs text-muted-foreground">No Media</div>
        }

        let src = ''
        if (typeof project.resultData === 'string') {
            src = project.resultData
        } else if (project.resultData instanceof Blob) {
            src = URL.createObjectURL(project.resultData)
        }

        if (project.resultType === 'png' || project.resultType === 'gif') {
            return <img src={src} alt="Preview" className="w-16 h-16 object-cover rounded border" />
        } else if (project.resultType === 'mp4') {
            return <video src={src} className="w-16 h-16 object-cover rounded border" muted loop playsInline />
        }
        return null
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant={inHomeContext ? "outline" : "ghost"} 
                    size={inHomeContext ? "lg" : "sm"} 
                    className={inHomeContext ? "gap-2 flex-1 md:flex-initial" : "gap-2"}
                >
                    <List className={inHomeContext ? "h-5 w-5" : "h-4 w-4"} />
                    Results
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] flex flex-col sm:max-w-md">
                <DialogHeader>
                    <div className="flex justify-between items-center mr-4">
                        <DialogTitle>Generated Results</DialogTitle>
                        {savedProjects.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                                Clear All
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {savedProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <List className="h-12 w-12 mb-4 opacity-20" />
                            <p>No results yet.</p>
                            <p className="text-sm">Export a project to automatically save it here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            {savedProjects.map((project) => (
                                <div key={project.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-card">
                                    <div className="flex justify-between items-start gap-3">
                                        {renderPreview(project)}
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm">{project.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(project.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1 mt-1">
                                        <span>Duration: {project.duration.toFixed(1)}s</span>
                                        <span>Size: {project.projectWidth}x{project.projectHeight}</span>
                                        <span>Tracks: {project.tracks.length}</span>
                                        {project.resultType && <span className="uppercase font-semibold text-primary/80">{project.resultType}</span>}
                                    </div>
                                    <div className="flex gap-2 mt-2 pt-2 border-t">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="flex-1 gap-2 h-8 text-xs"
                                            onClick={() => handleLoad(project)}
                                        >
                                            <Play className="h-3 w-3" />
                                            Load State
                                        </Button>
                                        {project.resultData && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-2 h-8 text-xs"
                                                onClick={() => handleDownloadMedia(project)}
                                            >
                                                <Download className="h-3 w-3" />
                                                File
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                            onClick={() => handleDelete(project.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
