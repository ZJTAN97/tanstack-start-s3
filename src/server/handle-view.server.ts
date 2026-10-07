import { z } from 'zod'
import { siteRoleSchema } from '~/shared/upload'
import { isSafeRelativePath } from './site-archive'
import type { SiteStore } from './site-store.server'

const viewParamsSchema = z.object({
  uploadId: z.uuid(),
  role: siteRoleSchema,
  _splat: z.string().refine(isSafeRelativePath),
})

const notFound = () => new Response('Not found', { status: 404 })

export async function handleView(params: unknown, store: SiteStore) {
  const parsed = viewParamsSchema.safeParse(params)
  if (!parsed.success) return notFound()

  const { _splat: path, ...site } = parsed.data
  const file = await store.readFile(site, path)
  if (!file) return notFound()

  const headers = new Headers({
    'Content-Type': file.contentType,
    // Uploaded HTML is untrusted: an opaque, script-less origin can't touch app cookies or APIs.
    'Content-Security-Policy': 'sandbox',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  })
  if (file.contentLength !== undefined) headers.set('Content-Length', String(file.contentLength))

  return new Response(file.body, { headers })
}
