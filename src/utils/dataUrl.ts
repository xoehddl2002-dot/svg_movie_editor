// Convert image URL to Data URL
export async function imageToDataURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            ctx.drawImage(img, 0, 0)

            try {
                const dataURL = canvas.toDataURL('image/png')
                resolve(dataURL)
            } catch (err) {
                reject(err)
            }
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = url
    })
}

// Convert video URL to Data URL (first frame as image)
export async function videoThumbnailToDataURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.preload = 'metadata'

        video.onloadeddata = () => {
            // Seek to 1 second to get a representative frame
            video.currentTime = Math.min(1, video.duration / 2)
        }

        video.onseeked = () => {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            ctx.drawImage(video, 0, 0)

            try {
                const dataURL = canvas.toDataURL('image/png')
                resolve(dataURL)
            } catch (err) {
                reject(err)
            }
        }

        video.onerror = () => reject(new Error('Failed to load video'))
        video.src = url
    })
}

// Fetch URL and convert to Data URL
export async function urlToDataURL(url: string, mimeType: string = 'image/png'): Promise<string> {
    try {
        const response = await fetch(url)
        const blob = await response.blob()

        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch (err) {
        throw new Error(`Failed to fetch and convert URL: ${err}`)
    }
}
