import { create } from 'zustand'
import { processTemplate } from '@/utils/template'
import { loadFont, checkFontLoaded } from '@/utils/fonts'
import { getRectPath } from '@/features/editor/utils/shapeUtils'

export type ResourceType = 'audio' | 'text' | 'shape' | 'icon' | 'mask'

export interface Clip {
    id: string
    trackId: string
    type: ResourceType
    start: number // seconds
    duration: number // seconds
    name: string
    src: string
    // Resource specific properties
    volume?: number
    fontFamily?: string
    fontSize?: number
    text?: string
    width?: number
    height?: number
    x?: number
    y?: number
    color?: string
    opacity?: number
    rotation?: number // degrees
    flipH?: boolean
    flipV?: boolean
    // Media specific
    mediaStart?: number // seconds offset into source video
    mediaType?: 'video' | 'image'
    customPath?: string // SVG path data for custom shapes
    viewBox?: string // SVG viewbox for custom shapes
    mask?: {
        x: number // percentage 0-100
        y: number // percentage 0-100
        width: number // percentage 0-100
        height: number // percentage 0-100
        shape?: 'rect' | 'circle'
        cornerRadius?: number // percentage
    }
    filter?: {
        brightness: number // 1 is normal
        contrast: number // 1 is normal
        saturate: number // 1 is normal
        blur: number // 0 is none
    }
    templateData?: any // Metadata for complex templates (JSON)
    // Editor controls from template
    editor_move?: boolean
    editor_scale?: boolean
    editor_rotate?: boolean
    attr_rock?: boolean
    image_id?: string
    shapes_id?: string
    max_length?: number
}

export interface AITemplateHistoryItem {
    id: string
    prompt: string
    type: 'full' | 'side' | 'top'
    svg: string
    json: any
    date: number
}

export interface Track {
    id: string
    type: ResourceType | 'mixed'
    clips: Clip[]
}

interface EditorState {
    tracks: Track[]
    currentTime: number
    duration: number
    zoom: number // pixels per second
    selectedClipId: string | null

    // Actions
    setTracks: (tracks: Track[]) => void
    setCurrentTime: (time: number) => void
    setDuration: (duration: number) => void
    setZoom: (zoom: number) => void
    setSelectedClipId: (id: string | null) => void
    addClip: (trackId: string, clip: Clip) => void
    removeClip: (clipId: string) => void
    updateClip: (clipId: string, updates: Partial<Clip>) => void
    moveClip: (clipId: string, newTrackId: string, updates: Partial<Clip>) => void
    addTrack: (type?: ResourceType | 'mixed', index?: number) => void
    swapTrackContents: (trackId1: string, trackId2: string) => void
    timelineHeight: number
    setTimelineHeight: (height: number) => void
    aspectRatio: number // width / height
    setAspectRatio: (ratio: number) => void
    projectWidth: number
    setProjectWidth: (width: number) => void
    projectHeight: number
    setProjectHeight: (height: number) => void

    initProjectWithTemplate: (template: { name: string, svg: string, json: any, category: string }) => Promise<void>
    canvasZoom: number
    setCanvasZoom: (zoom: number) => void
    editingClipId: string | null
    setEditingClipId: (id: string | null) => void
    isPlaying: boolean
    setIsPlaying: (isPlaying: boolean) => void
    setProjectState: (state: Partial<EditorState>) => void

    aiTemplateHistory: AITemplateHistoryItem[]
    setAITemplateHistory: (items: AITemplateHistoryItem[]) => void
    addAITemplateHistory: (item: AITemplateHistoryItem) => void
}

export const useStore = create<EditorState>((set, get) => ({
    tracks: [
        {
            id: 'audio-1',
            type: 'audio',
            clips: []
        },
        {
            id: 'mask-1',
            type: 'mask',
            clips: []
        }
    ],
    currentTime: 0,
    duration: 10,
    zoom: 100,
    selectedClipId: null,
    timelineHeight: 320,
    aspectRatio: 16 / 9,
    projectWidth: 1920,
    projectHeight: 1080,

    canvasZoom: 100,
    editingClipId: null,

    aiTemplateHistory: [],
    setAITemplateHistory: (items) => set({ aiTemplateHistory: items }),
    addAITemplateHistory: (item) => set((state) => {
        // Just prepend the newly passed item without rewriting its ID or date
        const newHistory = [item, ...state.aiTemplateHistory].slice(0, 50)
        return { aiTemplateHistory: newHistory }
    }),

    setProjectState: (newState) => set((state) => ({ ...state, ...newState })),
    setTracks: (tracks) => set({ tracks }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setZoom: (zoom) => set({ zoom }),
    setSelectedClipId: (id) => set((state) => {
        // Check if the currently selected clip is a text clip and is empty
        if (state.selectedClipId && state.selectedClipId !== id) {
            const currentClip = state.tracks.flatMap(t => t.clips).find(c => c.id === state.selectedClipId);
            if (currentClip && currentClip.type === 'text') {
                const textContent = currentClip.text?.trim() || '';
                if (textContent === '') {
                    // Remove the empty text clip
                    const newTracks = state.tracks.map(track => ({
                        ...track,
                        clips: track.clips.filter(c => c.id !== state.selectedClipId)
                    }));
                    return {
                        tracks: newTracks,
                        selectedClipId: id,
                        editingClipId: state.editingClipId === state.selectedClipId ? null : state.editingClipId
                    };
                }
            }
        }
        return { selectedClipId: id };
    }),
    setTimelineHeight: (height) => set({ timelineHeight: height }),
    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
    setProjectWidth: (width) => set({ projectWidth: width }),
    setProjectHeight: (height) => set({ projectHeight: height }),

    setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
    setEditingClipId: (id) => set({ editingClipId: id }),
    isPlaying: false,
    setIsPlaying: (isPlaying) => set({ isPlaying }),

    initProjectWithTemplate: async (template) => {
        const { duration } = get();
        const result = await processTemplate(template, duration);

        if (result) {
            set((state) => ({
                ...state,
                tracks: result.tracks,
                aspectRatio: result.aspectRatio,
                projectWidth: result.projectWidth || 1920,
                projectHeight: result.projectHeight || 1080,
                currentTime: 0
            }));

            // Load fonts from template if available
            // Load fonts from template if available
            if (result.fontList) {
                const fontMapList = Object.keys(result.fontList).map(family => ({
                    family,
                    url: `/assets/font/${family}.woff` // Assumption: font files are in /assets/font/ and have .woff extension
                }));

                try {
                    await loadFont(fontMapList);

                    // Verify if all fonts are loaded
                    const failedFonts = fontMapList.filter(item => !checkFontLoaded(item.family));

                    if (failedFonts.length > 0) {
                        console.warn('Failed fonts detected:', failedFonts.map(f => f.family));
                        // Instead of redirecting immediately, let's just warn and continue. 
                        // The user can still edit text without custom fonts.
                        // Or we can just log it for debugging and not block the redirect.
                        // alert(`다음 폰트를 불러오는데 실패했습니다: ${failedNames}\n확인을 누르면 메인 화면으로 이동합니다.`);
                        // window.location.href = '/';
                        // return;
                    }
                } catch (err) {
                    console.error("Failed to load template fonts:", err);
                    alert(`폰트 로딩 중 오류가 발생했습니다.\n확인을 누르면 메인 화면으로 이동합니다.`);
                    window.location.href = '/';
                    return;
                }
            }
        }
    },
    addClip: (trackId, clip) => set((state) => {
        // Enforce default mask for mask types if not present
        if (clip.type === 'mask') {
            if (!clip.templateData || Object.keys(clip.templateData).length === 0) {
                const w = clip.width || 500;
                const h = clip.height || 500;
                const pathD = getRectPath(0, 0, w, h);

                clip.templateData = {
                    "shape-1": {
                        type: "path",
                        d: pathD,
                        fill: "white",
                        id: "shape-1",
                        "data-shape-type": "rect",
                        x: 0,
                        y: 0,
                        width: w,
                        height: h
                    }
                };
                clip.viewBox = `0 0 ${w} ${h}`;
            }
        }

        return {
            tracks: state.tracks.map((track) =>
                track.id === trackId
                    ? { ...track, clips: [...track.clips, clip] }
                    : track
            )
        };
    }),

    removeClip: (clipId) => set((state) => ({
        tracks: state.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((c) => c.id !== clipId)
        })),
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
    })),

    updateClip: (clipId: string, updates: Partial<Clip>) => set((state) => ({
        tracks: state.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...updates } : clip
            )
        }))
    })),
    moveClip: (clipId, newTrackId, updates) => set((state) => {
        // Find the clip first
        let movedClip: Clip | null = null;
        const newTracks = state.tracks.map(track => {
            const clipIndex = track.clips.findIndex(c => c.id === clipId);
            if (clipIndex !== -1) {
                movedClip = { ...track.clips[clipIndex], ...updates, trackId: newTrackId };
                return { ...track, clips: track.clips.filter(c => c.id !== clipId) };
            }
            return track;
        });

        if (!movedClip) return { tracks: state.tracks };

        return {
            tracks: newTracks.map(track =>
                track.id === newTrackId
                    ? { ...track, clips: [...track.clips, movedClip!] }
                    : track
            )
        };
    }),

    addTrack: (type = 'mixed', index?: number) => set((state) => {
        const newTrack: Track = {
            id: `${type}-${state.tracks.filter(t => t.type === type).length + 1}-${Date.now()}`, // Ensure unique ID
            type,
            clips: []
        }

        const newTracks = [...state.tracks]
        if (index !== undefined && index >= 0 && index <= newTracks.length) {
            newTracks.splice(index, 0, newTrack)
        } else {
            newTracks.unshift(newTrack)
        }

        return { tracks: newTracks }
    }),

    swapTrackContents: (trackId1: string, trackId2: string) => set((state) => {
        const track1Index = state.tracks.findIndex(t => t.id === trackId1);
        const track2Index = state.tracks.findIndex(t => t.id === trackId2);

        if (track1Index === -1 || track2Index === -1) return { tracks: state.tracks };

        const track1 = state.tracks[track1Index];
        const track2 = state.tracks[track2Index];

        const newClips1 = track2.clips.map(c => ({ ...c, trackId: track1.id }));
        const newClips2 = track1.clips.map(c => ({ ...c, trackId: track2.id }));

        const newTracks = [...state.tracks];
        newTracks[track1Index] = { ...track1, clips: newClips1 };
        newTracks[track2Index] = { ...track2, clips: newClips2 };

        return { tracks: newTracks };
    })
}))
