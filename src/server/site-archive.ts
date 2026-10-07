import { unzipSync } from 'fflate'

export type SiteFile = { path: string; bytes: Uint8Array; contentType: string }

export type ExtractLimits = { maxEntries: number; maxUncompressedBytes: number }

export const DEFAULT_LIMITS: ExtractLimits = {
  maxEntries: 2000,
  maxUncompressedBytes: 200 * 1024 * 1024,
}

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

export class SiteArchiveError extends Error {}

export function isSafeRelativePath(path: string) {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !/^[a-zA-Z]:/.test(path) &&
    path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

function isOsJunk(path: string) {
  const name = path.split('/').at(-1)
  return path.startsWith('__MACOSX/') || name === '.DS_Store' || name === 'Thumbs.db'
}

function contentTypeFor(path: string) {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? ''
  const contentType = CONTENT_TYPES[extension]
  if (!contentType) throw new SiteArchiveError(`Unsupported file type: ${path}`)
  return contentType
}

function unzip(zip: Uint8Array, limits: ExtractLimits) {
  let entries = 0
  let uncompressedBytes = 0
  try {
    return unzipSync(zip, {
      // Runs on the central directory before inflating, so bombs are rejected without allocating.
      filter(file) {
        if (file.name.endsWith('/') || isOsJunk(file.name)) return false
        entries += 1
        uncompressedBytes += file.originalSize
        if (entries > limits.maxEntries) {
          throw new SiteArchiveError(`Too many files (max ${limits.maxEntries})`)
        }
        if (uncompressedBytes > limits.maxUncompressedBytes) {
          throw new SiteArchiveError('Uncompressed size exceeds limit')
        }
        return true
      },
    })
  } catch (error) {
    if (error instanceof SiteArchiveError) throw error
    throw new SiteArchiveError('Not a valid zip file')
  }
}

function stripSharedTopFolder(paths: string[]) {
  const top = paths[0]?.split('/')[0]
  const shared = paths.every((path) => path.includes('/') && path.split('/')[0] === top)
  return shared ? paths.map((path) => path.slice(top!.length + 1)) : paths
}

/** Unzips in memory into files keyed by their path relative to index.html. */
export function extractSite(zip: Uint8Array, limits = DEFAULT_LIMITS): SiteFile[] {
  const entries = Object.entries(unzip(zip, limits)).map(([name, bytes]) => ({
    name: name.replaceAll('\\', '/'),
    bytes,
  }))

  const unsafe = entries.find(({ name }) => !isSafeRelativePath(name))
  if (unsafe) throw new SiteArchiveError(`Unsafe path in zip: ${unsafe.name}`)

  const paths = stripSharedTopFolder(entries.map(({ name }) => name))
  if (!paths.includes('index.html')) throw new SiteArchiveError('index.html missing at zip root')

  return entries.map(({ bytes }, i) => ({
    path: paths[i]!,
    bytes,
    contentType: contentTypeFor(paths[i]!),
  }))
}
