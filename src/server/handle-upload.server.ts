import { z } from 'zod'
import {
  MAX_ZIP_BYTES,
  SITE_ROLES,
  sitePath,
  uploadFormSchema,
  type SiteRole,
  type UploadResult,
} from '~/shared/upload'
import { extractSite, SiteArchiveError, type SiteFile } from './site-archive'
import type { SiteStore } from './site-store.server'

const MAX_REQUEST_BYTES = SITE_ROLES.length * MAX_ZIP_BYTES + 1024 * 1024

const fail = (status: number, error: string) => Response.json({ error }, { status })

export async function handleUpload(request: Request, store: SiteStore) {
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) {
    return fail(413, 'Upload too large')
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) return fail(400, 'Expected multipart/form-data')

  const form = uploadFormSchema.safeParse(Object.fromEntries(formData))
  if (!form.success) return fail(400, z.prettifyError(form.error))

  // Extract all three before writing anything, so a bad zip never leaves a partial upload.
  const sites: { role: SiteRole; files: SiteFile[] }[] = []
  for (const role of SITE_ROLES) {
    try {
      const zip = new Uint8Array(await form.data[role].arrayBuffer())
      sites.push({ role, files: extractSite(zip) })
    } catch (error) {
      if (error instanceof SiteArchiveError) return fail(422, `${role}: ${error.message}`)
      throw error
    }
  }

  const uploadId = crypto.randomUUID()
  await Promise.all(sites.map(({ role, files }) => store.saveSite({ uploadId, role }, files)))

  const result: UploadResult = {
    uploadId,
    sites: Object.fromEntries(SITE_ROLES.map((role) => [role, sitePath(uploadId, role)])) as UploadResult['sites'],
  }
  return Response.json(result, { status: 201 })
}
