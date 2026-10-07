import { strToU8, zipSync } from 'fflate'

export function makeZip(files: Record<string, string | Uint8Array>) {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        typeof content === 'string' ? strToU8(content) : content,
      ]),
    ),
  )
}

export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

export function makeSiteZip(title: string) {
  return makeZip({
    'index.html': `<html><head><link rel="stylesheet" href="css/site.css"></head><body><h1>${title}</h1><img src="img/logo.png"></body></html>`,
    'css/site.css': 'h1 { color: rebeccapurple; }',
    'img/logo.png': PNG_BYTES,
  })
}
