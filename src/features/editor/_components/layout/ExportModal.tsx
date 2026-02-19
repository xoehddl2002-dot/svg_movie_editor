import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, Video, Image as ImageIcon } from "lucide-react"
import { useExportImage } from '@/features/editor/hooks/useExportImage'
import { useExportVideo } from '@/features/editor/hooks/useExportVideo'

export function ExportModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [format, setFormat] = useState<'mp4' | 'png'>('png')
    const [fps, setFps] = useState<number>(30)

    const { exportImage, isExporting: isExportingImage } = useExportImage()
    const { exportVideo, cancelExport, isExporting: isExportingVideo } = useExportVideo()

    const isExporting = isExportingImage || isExportingVideo

    const handleExport = async () => {
        if (format === 'mp4') {
            await exportVideo(fps)
            setIsOpen(false)
        } else {
            await exportImage()
            setIsOpen(false)
        }
    }

    const handleCancel = () => {
        if (isExportingVideo) {
            cancelExport()
        }
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

                            </SelectContent>
                        </Select>
                    </div>

                    {(format === 'mp4') && (
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
                                    <SelectItem value="24">24 FPS</SelectItem>
                                    <SelectItem value="30">30 FPS</SelectItem>
                                    <SelectItem value="60">60 FPS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    {isExporting && (
                        <Button variant="ghost" onClick={handleCancel} disabled={!isExportingVideo}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
