import { z } from 'zod'

export const MAX_ZIP_BYTES = 50 * 1024 * 1024

const zipFileSchema = z
  .instanceof(File, { message: 'A zip file is required' })
  .refine((file) => file.name.toLowerCase().endsWith('.zip'), 'Must be a .zip file')
  .refine((file) => file.size <= MAX_ZIP_BYTES, 'Zip must be 50 MB or smaller')

export const uploadFormSchema = z.object({
  report: zipFileSchema,
  summary: zipFileSchema,
  appendix: zipFileSchema,
})

export const siteRoleSchema = uploadFormSchema.keyof()
export type SiteRole = z.infer<typeof siteRoleSchema>
export const SITE_ROLES = siteRoleSchema.options

export const uploadResultSchema = z.object({
  uploadId: z.uuid(),
  sites: z.record(siteRoleSchema, z.string()),
})
export type UploadResult = z.infer<typeof uploadResultSchema>

export const errorResultSchema = z.object({ error: z.string() })

export function sitePath(uploadId: string, role: SiteRole) {
  return `/view/${uploadId}/${role}/index.html`
}
