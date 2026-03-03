'use client'

import { type Clip } from "@/features/editor/store/useStore"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

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

// Shape 클립 전용 속성 편집 컴포넌트 — 색상 변경
interface ShapePropertiesProps {
    clip: Clip
    updateClip: (id: string, updates: Partial<Clip>) => void
}

export function ShapeProperties({ clip, updateClip }: ShapePropertiesProps) {
    return (
        <div className="space-y-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Appearance</Label>
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
