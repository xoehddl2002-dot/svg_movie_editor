import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LayoutTemplate, Settings, Save, Upload } from "lucide-react"
import { ExportModal } from "./ExportModal"
import { AIMagicEditModal } from "./AIMagicEditModal"
import { useStore } from "@/features/editor/store/useStore"
import { useRef } from "react"
import { Input } from "@/components/ui/input"

export function Header() {
    const { tracks, duration, aspectRatio, currentTime, projectWidth, projectHeight, setProjectState } = useStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSaveProject = () => {
        const projectData = {
            tracks,
            duration,
            aspectRatio,
            projectWidth,
            projectHeight,
            currentTime,
            timestamp: Date.now()
        }

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `midnight-project-${Date.now()}.json`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
    }

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
                        projectWidth: data.projectWidth || 1920,
                        projectHeight: data.projectHeight || 1080,
                        currentTime: data.currentTime || 0,
                        selectedClipId: null
                    })
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

    return (
        <header className="flex h-14 items-center justify-between border-b bg-background px-4">
            <Link href="/" className="flex items-center gap-2">
                <LayoutTemplate className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">Midnight SVG Edit</span>
            </Link>
            <div className="flex items-center gap-2">
                <Input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleLoadProject}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={handleSaveProject}
                >
                    <Save className="h-4 w-4" />
                    Save
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-4 w-4" />
                    Load
                </Button>

                <div className="w-px h-6 bg-border mx-2" />

                <AIMagicEditModal />

                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
                <ExportModal />
            </div>
        </header>
    )
}
