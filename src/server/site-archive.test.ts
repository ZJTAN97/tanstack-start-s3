import { strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { makeSiteZip, makeZip, PNG_BYTES } from '~/test/zip'
import { extractSite, isSafeRelativePath, SiteArchiveError } from './site-archive'

const byPath = (zip: Uint8Array) =>
  Object.fromEntries(extractSite(zip).map((file) => [file.path, file]))

describe('extractSite', () => {
  it('returns every file with its relative path, bytes and content type', () => {
    const files = byPath(makeSiteZip('Hello'))

    expect(Object.keys(files).sort()).toEqual(['css/site.css', 'img/logo.png', 'index.html'])
    expect(files['index.html']!.contentType).toBe('text/html; charset=utf-8')
    expect(files['css/site.css']!.contentType).toBe('text/css; charset=utf-8')
    expect(files['img/logo.png']!.contentType).toBe('image/png')
    expect(files['img/logo.png']!.bytes).toEqual(PNG_BYTES)
  })

  it('strips a single wrapping folder (zipping a folder instead of its contents)', () => {
    const zip = makeZip({ 'export/index.html': '<h1/>', 'export/img/a.png': PNG_BYTES })

    expect(Object.keys(byPath(zip)).sort()).toEqual(['img/a.png', 'index.html'])
  })

  it('ignores macOS and Windows junk entries', () => {
    const zip = makeZip({
      'index.html': '<h1/>',
      '__MACOSX/._index.html': 'junk',
      'img/.DS_Store': 'junk',
      'Thumbs.db': 'junk',
    })

    expect(Object.keys(byPath(zip))).toEqual(['index.html'])
  })

  it('normalises backslash separators from Windows zip tools', () => {
    const zip = makeZip({ 'index.html': '<h1/>', 'img\\a.png': PNG_BYTES })

    expect(Object.keys(byPath(zip)).sort()).toEqual(['img/a.png', 'index.html'])
  })

  it.each([
    ['missing index.html', makeZip({ 'home.html': '<h1/>' }), 'index.html missing at zip root'],
    ['index.html not at root', makeZip({ 'a/index.html': '', 'b/x.css': '' }), 'index.html missing'],
    ['unsupported file type', makeZip({ 'index.html': '', 'run.exe': 'MZ' }), 'Unsupported file type: run.exe'],
    ['path traversal', makeZip({ 'index.html': '', '../evil.html': '' }), 'Unsafe path in zip'],
    ['not a zip', strToU8('definitely not a zip'), 'Not a valid zip file'],
  ])('rejects %s', (_, zip, message) => {
    expect(() => extractSite(zip)).toThrowError(SiteArchiveError)
    expect(() => extractSite(zip)).toThrowError(message)
  })

  it('rejects too many entries before inflating', () => {
    const zip = makeZip({ 'index.html': '', 'a.css': '', 'b.css': '' })

    expect(() => extractSite(zip, { maxEntries: 2, maxUncompressedBytes: 1e9 })).toThrowError(
      'Too many files (max 2)',
    )
  })

  it('rejects highly compressible bombs by declared uncompressed size', () => {
    const zip = makeZip({ 'index.html': '', 'big.css': new Uint8Array(5_000_000) })

    expect(zip.byteLength).toBeLessThan(10_000)
    expect(() => extractSite(zip, { maxEntries: 10, maxUncompressedBytes: 1_000_000 })).toThrowError(
      'Uncompressed size exceeds limit',
    )
  })
})

describe('isSafeRelativePath', () => {
  it.each(['index.html', 'img/a b.png', 'deep/nested/file.css'])('accepts %s', (path) => {
    expect(isSafeRelativePath(path)).toBe(true)
  })

  it.each(['', '/etc/passwd', 'C:/x', '../x', 'a/../../x', 'a//b', './a'])('rejects %j', (path) => {
    expect(isSafeRelativePath(path)).toBe(false)
  })
})
