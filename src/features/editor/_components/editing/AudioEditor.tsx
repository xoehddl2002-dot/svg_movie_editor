import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Music, Volume2, Scissors } from "lucide-react"
import { Clip } from "@/features/editor/store/useStore"
import { AudioWaveformEditor } from "./AudioWaveformEditor"
import { cn } from "@/lib/utils"

interface AudioEditorProps {
    clip: Clip
    onUpdate: (updates: Partial<Clip>) => void
    onClose: () => void
}

export function AudioEditor({ clip, onUpdate, onClose }: AudioEditorProps) {
    const [start, setStart] = useState(clip.mediaStart || 0)
    const [duration, setDuration] = useState(clip.duration || 0)
    const [volume, setVolume] = useState(clip.volume ?? 1)

    const handleSave = () => {
        onUpdate({
            mediaStart: start,
            duration: duration,
            volume: volume,
        })
        onClose()
    }

    return (
        <>
            <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center gap-2 space-y-0 bg-white dark:bg-zinc-950">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                    <Music className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg">Edit Audio: {clip.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground">AUDIO • ID: {clip.id.slice(0, 8)}</p>
                </div>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950 flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Waveform Editor Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <Scissors className="w-4 h-4" />
                            Waveform & Trim
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                            <div className="rounded border bg-background overflow-hidden">
                                <AudioWaveformEditor
                                    src={clip.src}
                                    initialStart={start}
                                    initialDuration={duration}
                                    onChange={(s, d) => {
                                        setStart(s)
                                        setDuration(d)
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-xs">Start Offset (s)</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{start.toFixed(2)}s</span>
                                    </div>
                                    <Slider
                                        value={[start]}
                                        max={600}
                                        step={0.1}
                                        onValueChange={([v]) => setStart(v)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-xs">Duration (s)</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{duration.toFixed(2)}s</span>
                                    </div>
                                    <Slider
                                        value={[duration]}
                                        max={600}
                                        step={0.1}
                                        onValueChange={([v]) => setDuration(v)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Properties */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <Volume2 className="w-4 h-4" />
                            Audio Mixing
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label className="text-xs">Volume</Label>
                                    <span className="text-xs font-mono text-muted-foreground">{Math.round(volume * 100)}%</span>
                                </div>
                                <Slider
                                    value={[volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={([v]) => setVolume(v)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0 bg-white dark:bg-zinc-950">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Save Changes</Button>
            </DialogFooter>
        </>
    )
}
