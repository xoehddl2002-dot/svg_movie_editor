import { Track } from '@/features/editor/store/useStore';

export interface SavedProject {
    id: string; // timestamp or uuid
    timestamp: number;
    name: string;
    duration: number;
    tracks: Track[];
    aspectRatio: number;
    projectWidth: number;
    projectHeight: number;
    currentTime: number;
    resultData?: Blob | string; // Blob for Video/GIF, base64 string for Image
    resultType?: 'png' | 'mp4' | 'gif';
}

const DB_NAME = 'MidnightProjectDB';
const DB_VERSION = 1;
const STORE_NAME = 'exported_projects';
const MAX_SAVED_PROJECTS = 10;

// Initialize IDB
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[AutoSave] Failed to open IndexedDB');
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // We use 'timestamp' as the primary key/index for easy sorting and limiting
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: true });
            }
        };
    });
};

export const saveExportedProject = async (projectData: Omit<SavedProject, 'id' | 'timestamp' | 'name'>): Promise<string | null> => {
    try {
        const db = await initDB();
        const timestamp = Date.now();
        const newProject: SavedProject = {
            ...projectData,
            id: `export-${timestamp}`,
            timestamp,
            name: `Exported at ${new Date(timestamp).toLocaleString()}`,
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Add the new project
            store.add(newProject);

            // Enforce limit
            const index = store.index('timestamp');
            const countRequest = index.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;
                if (count > MAX_SAVED_PROJECTS) {
                    // Open cursor in ascending order (oldest first)
                    const cursorRequest = index.openCursor();
                    let deleteCount = count - MAX_SAVED_PROJECTS;

                    cursorRequest.onsuccess = (e) => {
                        const cursor = (e.target as IDBRequest).result;
                        if (cursor && deleteCount > 0) {
                            store.delete(cursor.primaryKey);
                            deleteCount--;
                            cursor.continue();
                        }
                    };
                }
            };

            transaction.oncomplete = () => {
                console.log(`[AutoSave] Project successfully auto-saved to IndexedDB.`);
                resolve(newProject.id);
            };

            transaction.onerror = () => {
                console.error('[AutoSave] Transaction error:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('[AutoSave] Failed to save project to IndexedDB:', error);
        return null;
    }
};

export const getExportedProjects = async (): Promise<SavedProject[]> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            
            // Open cursor in descending order (newest first)
            const request = index.openCursor(null, 'prev');
            const projects: SavedProject[] = [];

            request.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    projects.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(projects);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[AutoSave] Failed to get exported projects:', error);
        return [];
    }
};

export const deleteExportedProject = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`[AutoSave] Failed to delete project ${id}:`, error);
    }
};

export const clearExportedProjects = async (): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[AutoSave] Failed to clear exported projects:', error);
    }
};
