import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, Video, Image as ImageIcon, Film } from "lucide-react"
import { useExportImage } from '@/features/editor/hooks/useExportImage'
import { useExportVideo } from '@/features/editor/hooks/useExportVideo'
import { useExportGif } from '@/features/editor/hooks/useExportGif'
import { Progress } from "@/components/ui/progress"

export function ExportModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [format, setFormat] = useState<'mp4' | 'gif' | 'png'>('png')
    const [fps, setFps] = useState<number>(20)

    const { exportImage, isExporting: isExportingImage, progress: progressImage, status: statusImage } = useExportImage()
    const { exportVideo, cancelExport: cancelVideoExport, isExporting: isExportingVideo, progress: progressVideo, status: statusVideo } = useExportVideo()
    const { exportGif, cancelExport: cancelGifExport, isExporting: isExportingGif, progress: progressGif, status: statusGif } = useExportGif()

    const isExporting = isExportingImage || isExportingVideo || isExportingGif
    const progress = isExportingVideo ? progressVideo : isExportingGif ? progressGif : progressImage
    const status = isExportingVideo ? statusVideo : isExportingGif ? statusGif : statusImage

    const handleExport = async () => {
        console.log(`[Export Debug] Handle Export Clicked. Format: ${format}, FPS: ${fps}`)
        if (format === 'mp4') {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (process.env.NODE_ENV === 'production' && !isLocal) {
                alert("Video export is currently disabled in the deployment environment due to server memory constraints. Please run locally to export video.")
                return
            }
            await exportVideo(fps)
            setIsOpen(false)
        } else if (format === 'gif') {
            await exportGif(fps)
            setIsOpen(false)
        } else {
            await exportImage()
            setIsOpen(false)
        }
    }

    const handleCancel = () => {
        if (isExportingVideo) cancelVideoExport()
        if (isExportingGif) cancelGifExport()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(val) => !isExporting && setIsOpen(val)}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Project</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <Select
                            value={format}
                            onValueChange={(v: 'mp4' | 'png') => setFormat(v)}
                            disabled={isExporting}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="png">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        <span>Image (Current Frame .png)</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="mp4">
                                    <div className="flex items-center gap-2">
                                        <Video className="h-4 w-4" />
                                        <span>Video (.mp4)</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="gif">
                                    <div className="flex items-center gap-2">
                                        <Film className="h-4 w-4" />
                                        <span>Animated GIF (.gif)</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(format === 'mp4' || format === 'gif') && (
                        <div className="space-y-2">
                            <Label>Frame Rate (FPS)</Label>
                            <Select
                                value={fps.toString()}
                                onValueChange={(v) => setFps(Number(v))}
                                disabled={isExporting}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="20">20 FPS</SelectItem>
                                    <SelectItem value="24">24 FPS</SelectItem>
                                    <SelectItem value="30">30 FPS</SelectItem>
                                    <SelectItem value="60">60 FPS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {isExporting && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span>{status === 'encoding' ? 'Encoding...' : 'Rendering...'}</span>
                                <span className="text-muted-foreground">{progress}%</span>
                            </div>
                            <Progress value={progress} />
                            {status === 'encoding' && (
                                <p className="text-xs text-muted-foreground">This may take a while...</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    {isExporting && (
                        <Button variant="ghost" onClick={handleCancel} disabled={!isExportingVideo && !isExportingGif}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isExporting ? (status === 'encoding' ? 'Encoding...' : 'Rendering...') : 'Export'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
