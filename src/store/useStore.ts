import { create } from 'zustand'
import { getStrokedBBox, getBBox } from '../lib/svg/utilities'

export type ResourceType = 'video' | 'audio' | 'image' | 'text' | 'shape' | 'icon'

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
  customPath?: string // SVG path data for custom shapes
  viewBox?: string // SVG viewbox for custom shapes
  crop?: {
    x: number // percentage 0-100
    y: number // percentage 0-100
    width: number // percentage 0-100
    height: number // percentage 0-100
  }
  filter?: {
    brightness: number // 1 is normal
    contrast: number // 1 is normal
    saturate: number // 1 is normal
    blur: number // 0 is none
  }
  templateData?: any // Metadata for complex templates (JSON)
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

  initProjectWithTemplate: (template: { name: string, svg: string, json: any, category: string }) => Promise<void>
  canvasZoom: number
  setCanvasZoom: (zoom: number) => void
  editingClipId: string | null
  setEditingClipId: (id: string | null) => void
  isPlaying: boolean
  setIsPlaying: (isPlaying: boolean) => void
  setProjectState: (state: Partial<EditorState>) => void
}

export const useStore = create<EditorState>((set) => ({
  tracks: [
    {
      id: 'audio-1',
      type: 'audio',
      clips: []
    },
    {
      id: 'video-1',
      type: 'video',
      clips: []
    }
  ],
  currentTime: 0,
  duration: 10,
  zoom: 100,
  selectedClipId: null,
  timelineHeight: 320,
  aspectRatio: 16 / 9,

  canvasZoom: 100,
  editingClipId: null,

  setProjectState: (newState) => set((state) => ({ ...state, ...newState })),
  setTracks: (tracks) => set({ tracks }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

  setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
  setEditingClipId: (id) => set({ editingClipId: id }),
  isPlaying: false,
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  initProjectWithTemplate: async (template) => {
    let jsonData = template.json;
    if (typeof template.json === 'string') {
      try {
        const res = await fetch(template.json);
        jsonData = await res.json();
      } catch (err) {
        console.error("Failed to fetch template JSON:", err);
        return;
      }
    }

    let svgDoc: Document;
    try {
      const res = await fetch(template.svg);
      const svgText = await res.text();
      const parser = new DOMParser();
      svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    } catch (err) {
      console.error("Failed to fetch or parse template SVG:", err);
      return;
    }

    const { v4: uuidv4 } = await import('uuid');

    set((state) => {
      let ratio = 16 / 9;
      if (template.category === 'F') ratio = 1920 / 1080;
      else if (template.category === 'S') ratio = 1080 / 1920;
      else if (template.category === 'T') ratio = 1820 / 118;

      const projectWidth = 1920;

      // Extract SVG dimensions to calculate scale factor
      const rootElement = svgDoc.documentElement;
      let svgWidth = 1920;
      let svgHeight = 1080;
      const viewBoxAttr = rootElement.getAttribute('viewBox');
      const widthAttr = rootElement.getAttribute('width');
      const heightAttr = rootElement.getAttribute('height');

      if (viewBoxAttr) {
        const parts = viewBoxAttr.split(/\s+|,/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
          svgWidth = parts[2];
          svgHeight = parts[3];
        }
      } else if (widthAttr && heightAttr) {
        svgWidth = parseFloat(widthAttr);
        svgHeight = parseFloat(heightAttr);
      }

      // Calculate Scale Factor
      const scale = projectWidth / svgWidth;

      if (svgWidth && svgHeight) {
        ratio = svgWidth / svgHeight;
      }

      // Calculate base URL for resolving relative image paths
      const templateBaseUrl = template.svg.substring(0, template.svg.lastIndexOf('/') + 1);

      // Extract global definitions
      let defsString = '';
      const defs = svgDoc.querySelectorAll('defs');
      defs.forEach(el => {
        defsString += new XMLSerializer().serializeToString(el);
      });
      const styles = svgDoc.querySelectorAll('style');
      styles.forEach(el => {
        if (!el.closest('defs')) {
          defsString += new XMLSerializer().serializeToString(el);
        }
      });

      const rootFree = svgDoc.documentElement.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;

      // Helper to determine clip type and validity from JSON item
      interface TempClipData {
        element: Element;
        item: any;
        type: ResourceType;
        id: string; // SVG ID
      }

      const validClips: TempClipData[] = [];
      const items = jsonData.item || {};

      Object.entries(items).forEach(([key, item]: [string, any]) => {
        const element = svgDoc.getElementById(key);
        if (!element) return; // Skip if element not found in SVG

        const nodeName = item.nodeName?.toLowerCase();
        let type: ResourceType | null = 'icon';

        if (nodeName === 'text') {
          type = 'text';
        } else if (nodeName === 'image') {
          if (item.image_id && item.image_id === item.id) {
            type = 'image';
          }
        } else if (['rect', 'path', 'polygon', 'circle', 'ellipse', 'line', 'polyline'].includes(nodeName)) {
          if (item.shapes_id && item.shapes_id === item.id) {
            type = 'shape';
          }
        }

        if (type) {
          validClips.push({ element, item, type, id: key });
        }
      });

      // Sort by DOM order to ensure correct layering (Back to Front)
      validClips.sort((a, b) => {
        const position = a.element.compareDocumentPosition(b.element);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a comes before b
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;  // b comes before a
        return 0;
      });

      // Reverse to get Front-to-Back order for tracks (Track 0 is Top/Front)
      const orderedClips = [...validClips].reverse();

      const newClips: Clip[] = [];

      // Append SVG to DOM for BBox calculations
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.visibility = 'hidden';
      hiddenContainer.style.position = 'absolute';
      hiddenContainer.style.width = '0';
      hiddenContainer.style.height = '0';
      hiddenContainer.style.overflow = 'hidden';
      hiddenContainer.appendChild(rootElement);
      document.body.appendChild(hiddenContainer);

      const mockAddSVGElementsFromJson = (data: any) => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", data.element);
        if (data.attr) {
          Object.entries(data.attr).forEach(([k, v]) => el.setAttribute(k, v as string));
        }
        return el;
      };
      const mockPathActions = {
        resetOrientation: (path: any) => { }
      };

      try {
        orderedClips.forEach((data) => {
          const { element, type, item } = data;
          const tagName = element.tagName.toLowerCase();

          let x = 0, y = 0, width = 100, height = 100, rotation = 0, opacity = 1;
          let src = '';
          let fill: string | undefined;
          let textContent = '';
          let fontFamily = 'sans-serif';
          let fontSize = 24;
          let bboxString = rootFree;

          // Calculate BBox first
          try {
            let bbox;
            // Use getStrokedBBox for groups to include all children strokes
            if (tagName === 'g') {
              bbox = getStrokedBBox([element], mockAddSVGElementsFromJson, mockPathActions);
            } else {
              bbox = getBBox(element);
            }

            if (bbox) {
              x = bbox.x * scale;
              y = bbox.y * scale;
              width = bbox.width * scale;
              height = bbox.height * scale;
              bboxString = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
            } else {
              width = 200;
              height = 200;
            }
          } catch (e) {
            console.warn("Failed to calculate BBox for", data.id, e);
            width = 200;
            height = 200;
          }

          // Parse Transform for rotation only (position is handled by bbox)
          const transform = element.getAttribute('transform');
          if (transform) {
            const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
            if (rotateMatch) {
              rotation = parseFloat(rotateMatch[1]);
            }
          }

          // Common Attributes
          opacity = parseFloat(element.getAttribute('opacity') || '1');

          if (type === 'text') {
            // Font size needs scaling but x/y are from bbox
            fontSize = (parseFloat(element.getAttribute('font-size') || '24')) * scale;
            fontFamily = element.getAttribute('font-family') || 'sans-serif';
            fill = element.getAttribute('fill') || '#000000';
            textContent = element.textContent || element.innerHTML || '';
          } else if (type === 'image') {
            src = 'https://placehold.co/600x400'; // Default placeholder

            let href = element.getAttribute('href') || element.getAttribute('xlink:href');
            if (href) {
              if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('/')) {
                href = templateBaseUrl + href;
              }
              src = href;
            }
          } else if (type === 'icon' || type === 'shape') {
            if (type === 'shape') {
              fill = element.getAttribute('fill') || '#000000';

              // Find fill from shapes_id element
              const shapesId = item.shapes_id;
              if (shapesId) {
                const shapeElement = svgDoc.getElementById(shapesId);
                if (shapeElement) {
                  const shapeFill = shapeElement.getAttribute('fill');
                  if (shapeFill) {
                    fill = shapeFill;
                  }
                }
              }
            }

            const serialized = new XMLSerializer().serializeToString(element);
            const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${bboxString}'>${defsString}${serialized}</svg>`;
            src = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
          }

          const clip: Clip = {
            id: uuidv4(),
            trackId: '',
            type: type as ResourceType,
            start: 0,
            duration: state.duration,
            name: item.id || data.id,
            src: src,
            text: textContent,
            fontFamily,
            fontSize,
            color: fill,
            x,
            y,
            width,
            height,
            rotation,
            opacity,
            templateData: { [data.id]: item }
          };
          newClips.push(clip);
        });
      } finally {
        // Clean up DOM
        if (hiddenContainer.parentNode) {
          hiddenContainer.parentNode.removeChild(hiddenContainer);
        }
      }

      // Create tracks
      const initialTracks: Track[] = [
        { id: 'audio-1', type: 'audio', clips: [] },
        { id: 'video-1', type: 'video', clips: [] }
      ];

      // Assign to tracks
      newClips.forEach((clip, index) => {
        const trackId = `track-${index}`;
        clip.trackId = trackId;
        initialTracks.push({
          id: trackId,
          type: clip.type === 'text' ? 'text' : 'shape',
          clips: [clip]
        });
      });

      return {
        tracks: initialTracks,
        aspectRatio: ratio,
        currentTime: 0
      };
    });
  },
  addClip: (trackId, clip) => set((state) => ({
    tracks: state.tracks.map((track) =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track
    )
  })),

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
