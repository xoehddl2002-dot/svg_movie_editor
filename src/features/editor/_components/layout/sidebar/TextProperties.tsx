'use client'

import { type Clip } from "@/features/editor/store/useStore"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { loadFont } from "@/utils/fonts"
import { useState, useEffect } from "react"

// 색상 프리셋 선택기 컴포넌트
function ColorPicker({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
    const presets = ['none', '#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

    return (
        <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
                {presets.map(color => (
                    <div
                        key={color}
                        className={`w-6 h-6 rounded-full cursor-pointer border flex item-center justify-center relative overflow-hidden ${value === color ? 'ring-2 ring-primary ring-offset-2 z-10' : ''}`}
                        style={{ backgroundColor: color === 'none' ? 'transparent' : color }}
                        onClick={() => onChange(color)}
                        title={color === 'none' ? 'No Color (Transparent)' : color}
                    >
                        {color === 'none' && (
                            <div className="absolute inset-0 w-full h-full">
                                <svg width="100%" height="100%" viewBox="0 0 24 24">
                                    <line x1="0" y1="24" x2="24" y2="0" stroke="red" strokeWidth="2" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <div className="relative w-9 h-9 flex-shrink-0 rounded-md overflow-hidden border border-input shadow-sm">
                    <input
                        type="color"
                        value={value || '#000000'}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer p-0 border-0"
                    />
                </div>
                <Input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 font-mono text-xs"
                    placeholder="#000000"
                    maxLength={9}
                />
            </div>
        </div>
    )
}

// 텍스트 클립 전용 속성 편집 컴포넌트
// - Content(textarea), Font Family, Font Size, Line Height, Text Align, Color
interface TextPropertiesProps {
    clip: Clip
    updateClip: (id: string, updates: Partial<Clip>) => void
}

export function TextProperties({ clip, updateClip }: TextPropertiesProps) {
    // 폰트 목록 로드
    const [fonts, setFonts] = useState<string[]>([])

    useEffect(() => {
        fetch('/api/fonts')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setFonts(data)
            })
            .catch(err => console.error('Failed to fetch fonts:', err))
    }, [])

    return (
        <div className="space-y-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Typography</Label>
            {/* 텍스트 내용 입력 (멀티라인 지원) */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Content</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                        {(clip.text || '').length} / {clip.max_length ?? 15}
                    </span>
                </div>
                <textarea
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    rows={3}
                    value={clip.text || ''}
                    maxLength={clip.max_length ?? 15}
                    onChange={(e) => updateClip(clip.id, { text: e.target.value })}
                />
            </div>
            {/* 폰트 선택 */}
            <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                    value={clip.fontFamily || ""}
                    onValueChange={async (font) => {
                        await loadFont({
                            family: font,
                            url: `/assets/font/${font}.woff`
                        });
                        updateClip(clip.id, { fontFamily: font });
                    }}
                >
                    <SelectTrigger className="w-full text-xs h-8">
                        <SelectValue placeholder="Select a font" />
                    </SelectTrigger>
                    <SelectContent side="bottom" position="popper" className="bg-transparent backdrop-blur-md shadow-lg border-white/10 prevent-deselect">
                        {fonts.map(font => (
                            <SelectItem 
                                key={font} 
                                value={font} 
                                style={{ fontFamily: `"${font}"` }}
                                className="focus:bg-white/10 focus:text-white cursor-pointer transition-colors"
                            >
                                {font}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {/* 폰트 크기 */}
            <div className="space-y-2">
                <Label>Font Size</Label>
                <Slider
                    value={[clip.fontSize || 120]}
                    min={10}
                    max={200}
                    step={1}
                    onValueChange={(val) => updateClip(clip.id, { fontSize: val[0] })}
                />
                <div className="text-right text-xs text-muted-foreground">{clip.fontSize || 120}px</div>
            </div>
            {/* 줄 간격 */}
            <div className="space-y-2">
                <Label>Line Height</Label>
                <Slider
                    value={[clip.lineHeight ?? 1.2]}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onValueChange={(val) => updateClip(clip.id, { lineHeight: val[0] })}
                />
                <div className="text-right text-xs text-muted-foreground">{(clip.lineHeight ?? 1.2).toFixed(1)}</div>
            </div>
            {/* 자간 */}
            <div className="space-y-2">
                <Label>Letter Spacing</Label>
                <Slider
                    value={[clip.letterSpacing ?? 0]}
                    min={-0.5}
                    max={1}
                    step={0.05}
                    onValueChange={(val) => updateClip(clip.id, { letterSpacing: val[0] })}
                />
                <div className="text-right text-xs text-muted-foreground">{(clip.letterSpacing ?? 0).toFixed(2)} em</div>
            </div>
            {/* 텍스트 정렬 */}
            <div className="space-y-2">
                <Label>Text Align</Label>
                <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => {
                        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                        const isActive = (clip.textAlign || 'center') === align;
                        return (
                            <Button
                                key={align}
                                variant={isActive ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-8"
                                onClick={() => updateClip(clip.id, { textAlign: align })}
                            >
                                <Icon className="h-4 w-4" />
                            </Button>
                        );
                    })}
                </div>
            </div>
            {/* 텍스트 세로쓰기 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Vertical Text</Label>
                    <Button
                        variant={clip.isVertical ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => updateClip(clip.id, { isVertical: !clip.isVertical })}
                    >
                        {clip.isVertical ? 'On' : 'Off'}
                    </Button>
                </div>
            </div>
            {/* 텍스트 곡선 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Text Curve</Label>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => updateClip(clip.id, { textCurve: clip.textCurve ? 0 : 50 })}
                    >
                        {clip.textCurve ? 'Disable' : 'Enable'}
                    </Button>
                </div>
                {clip.textCurve !== undefined && clip.textCurve !== 0 && (
                    <>
                        <Slider
                            value={[clip.textCurve]}
                            min={-500}
                            max={500}
                            step={1}
                            onValueChange={(val) => updateClip(clip.id, { textCurve: val[0] })}
                        />
                        <div className="text-right text-xs text-muted-foreground">{clip.textCurve}</div>
                    </>
                )}
            </div>
            {/* 색상 */}
            <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker
                    value={clip.color}
                    onChange={(color) => updateClip(clip.id, { color })}
                />
            </div>
        </div>
    )
}
