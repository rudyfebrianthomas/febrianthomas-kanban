import { supabase } from './supabase'

const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const maxKanbanImageSize = 5 * 1024 * 1024

export function kanbanImageExtension(file: Pick<File, 'type' | 'size'>): string | null {
  if (file.size <= 0 || file.size > maxKanbanImageSize || !Object.hasOwn(imageExtensions, file.type)) return null
  return imageExtensions[file.type] ?? null
}

async function mayBeAnimated(file: File): Promise<boolean> {
  if (file.type === 'image/gif') return true
  if (file.type === 'image/jpeg') return false
  const data = new DataView(await file.arrayBuffer())
  if (file.type === 'image/webp') {
    if (data.byteLength < 21 || data.getUint32(0) !== 0x52494646 || data.getUint32(8) !== 0x57454250) return true
    return data.getUint32(12) === 0x56503858 && (data.getUint8(20) & 2) !== 0
  }
  if (file.type === 'image/png') {
    if (data.byteLength < 8 || data.getUint32(0) !== 0x89504e47 || data.getUint32(4) !== 0x0d0a1a0a) return true
    for (let offset = 8; offset + 12 <= data.byteLength; ) {
      const length = data.getUint32(offset)
      const type = data.getUint32(offset + 4)
      if (length > data.byteLength - offset - 12) return true
      if (type === 0x6163544c) return true
      if (type === 0x49444154) return false
      offset += 12 + length
    }
  }
  return true
}

async function optimizeGif(file: File): Promise<File> {
  const { default: gifsicle } = await import('gifsicle-wasm-browser')
  const outputs = await gifsicle.run({
    input: [{ file, name: 'input.gif' }],
    command: ['-O2 --lossy=60 --resize-fit 1600x1600 input.gif -o /out/output.gif'],
  })
  const out = outputs?.[0]
  if (!out || out.type !== 'image/gif' || out.size === 0 || out.size >= file.size) return file
  return new File([out], 'kanban-image.gif', { type: out.type, lastModified: file.lastModified })
}

async function optimizeKanbanImage(file: File): Promise<File> {
  try {
    if (file.type === 'image/gif') return await optimizeGif(file)
    if (await mayBeAnimated(file)) return file
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not decode image'))
        image.src = url
      })
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return file
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
      if (!blob || blob.type !== 'image/webp' || blob.size === 0 || blob.size >= file.size) return file
      return new File([blob], 'kanban-image.webp', { type: blob.type, lastModified: file.lastModified })
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return file
  }
}

export async function uploadKanbanImage(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured')
  const optimized = await optimizeKanbanImage(file)
  const ext = kanbanImageExtension(optimized)
  if (!ext) throw new Error('Invalid image')
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('kanban-images')
    .upload(path, optimized, { contentType: optimized.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeKanbanImages(paths: Array<string | null | undefined>): Promise<void> {
  if (!supabase) return
  const validPaths = paths.filter((path): path is string => Boolean(path))
  if (validPaths.length === 0) return
  await supabase.storage.from('kanban-images').remove(validPaths).catch(() => {})
}

export function revokeBlobUrls(urls: Array<string | undefined>): void {
  for (const url of urls) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}
