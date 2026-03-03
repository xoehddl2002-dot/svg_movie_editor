'use client'

import { type Clip } from "@/features/editor/store/useStore"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"

const DEFAULT_FILTER = { brightness: 1, contrast: 1, saturate: 1, blur: 0 }

// 비디오 트림 슬라이더 — 소스 비디오의 시작/끝 지점 조정
function VideoTrimSlider({ clip, updateClip }: { clip: Clip, updateClip: (id: string, updates: Partial<Clip>) => void }) {
    const [sourceDuration, setSourceDuration] = useState<number>(0);

    useEffect(() => {
        const loadMetadata = () => {
            const video = document.createElement('video');
            video.src = clip.src;
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                if (isFinite(video.duration)) {
                    setSourceDuration(video.duration);
                }
            };
        };
        loadMetadata();
    }, [clip.src]);

    const start = clip.mediaStart || 0;
    const end = start + (clip.duration || 0);
    // Use sourceDuration if available, otherwise fallback to reasonable max
    const max = sourceDuration || Math.max(end + 10, 60);

    return (
        <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Start: {start.toFixed(1)}s</span>
                <span>End: {end.toFixed(1)}s</span>
            </div>
            <Slider
                value={[start, end]}
                max={max}
                step={0.1}
                min={0}
                minStepsBetweenThumbs={0.1}
                onValueChange={([newStart, newEnd]) => {
                    // Constraint: End must be > Start. Slider handles this but we ensure min duration.
                    const duration = newEnd - newStart;
                    if (duration < 0.1) return;

                    updateClip(clip.id, {
                        mediaStart: newStart,
                        duration: duration
                    });
                }}
                className="py-4"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0s</span>
                <span>{max.toFixed(1)}s</span>
            </div>
        </div>
    );
}

// Mask 클립 전용 속성 편집 컴포넌트
// - 비디오 트림 (mask + video인 경우)
// - 필터 (밝기, 대비, 채도, 블러)
interface MaskPropertiesProps {
    clip: Clip
    updateClip: (id: string, updates: Partial<Clip>) => void
}

export function MaskProperties({ clip, updateClip }: MaskPropertiesProps) {
    const isVideo = !!(clip.src.match(/\.(mp4|webm|mov|m4v)$/i) || clip.src.startsWith('blob:video/'));

    return (
        <>
            {/* 비디오 트림 (mask + video인 경우에만 표시) */}
            {isVideo && (
                <div className="space-y-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Video Edit</Label>
                    <VideoTrimSlider clip={clip} updateClip={updateClip} />
                </div>
            )}

            {/* 이미지/비디오 필터 */}
            <div className="space-y-4">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Image/Video Mask &amp; Filter</Label>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Filters</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => updateClip(clip.id, { filter: clip.filter ? undefined : DEFAULT_FILTER })}
                        >
                            {clip.filter ? 'Reset' : 'Enable'}
                        </Button>
                    </div>
                    {clip.filter && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Brightness ({clip.filter.brightness})</Label>
                                <Slider
                                    value={[clip.filter.brightness]} min={0} max={2} step={0.1}
                                    onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, brightness: val[0] } })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Contrast ({clip.filter.contrast})</Label>
                                <Slider
                                    value={[clip.filter.contrast]} min={0} max={2} step={0.1}
                                    onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, contrast: val[0] } })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Saturation ({clip.filter.saturate})</Label>
                                <Slider
                                    value={[clip.filter.saturate]} min={0} max={2} step={0.1}
                                    onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, saturate: val[0] } })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Blur ({clip.filter.blur}px)</Label>
                                <Slider
                                    value={[clip.filter.blur]} min={0} max={10} step={0.5}
                                    onValueChange={(val) => updateClip(clip.id, { filter: { ...clip.filter!, blur: val[0] } })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
