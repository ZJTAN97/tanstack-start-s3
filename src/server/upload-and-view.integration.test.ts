import {
  GetBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { describe, expect, inject, it } from 'vitest'
import { SITE_ROLES, uploadResultSchema, type SiteRole } from '~/shared/upload'
import { makeSiteZip, makeZip, PNG_BYTES } from '~/test/zip'
import { handleUpload } from './handle-upload.server'
import { handleView } from './handle-view.server'
import { createS3Client } from './s3-client.server'
import { createSiteStore } from './site-store.server'

const config = inject('s3Config')
const client = createS3Client(config)
const store = createSiteStore(client, config.bucket)

const validZips = {
  report: makeSiteZip('report'),
  summary: makeSiteZip('summary'),
  appendix: makeSiteZip('appendix'),
}

function upload(zips: Partial<Record<SiteRole, Uint8Array>>) {
  const form = new FormData()
  for (const [role, bytes] of Object.entries(zips)) {
    form.append(role, new File([new Uint8Array(bytes)], `${role}.zip`, { type: 'application/zip' }))
  }
  return handleUpload(new Request('http://test/api/uploads', { method: 'POST', body: form }), store)
}

function view(uploadId: string, role: string, path: string) {
  return handleView({ uploadId, role, _splat: path }, store)
}

async function countStoredObjects() {
  const list = await client.send(new ListObjectsV2Command({ Bucket: config.bucket }))
  return list.KeyCount ?? 0
}

describe('upload → MinIO → view', () => {
  it('stores each zip under its own folder and serves every file behind a sandbox CSP', async () => {
    const response = await upload(validZips)

    expect(response.status).toBe(201)
    const result = uploadResultSchema.parse(await response.json())

    for (const role of SITE_ROLES) {
      expect(result.sites[role]).toBe(`/view/${result.uploadId}/${role}/index.html`)
      const page = await view(result.uploadId, role, 'index.html')
      expect(page.status).toBe(200)
      expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(page.headers.get('content-security-policy')).toBe('sandbox')
      expect(await page.text()).toContain(`<h1>${role}</h1>`)
    }

    const css = await view(result.uploadId, 'report', 'css/site.css')
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(await css.text()).toBe('h1 { color: rebeccapurple; }')

    const image = await view(result.uploadId, 'report', 'img/logo.png')
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(image.headers.get('content-length')).toBe(String(PNG_BYTES.byteLength))
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(PNG_BYTES)
  })

  it('rejects the whole upload and writes nothing when any zip is invalid', async () => {
    const before = await countStoredObjects()

    const response = await upload({ ...validZips, summary: makeZip({ 'home.html': '' }) })

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'summary: index.html missing at zip root' })
    expect(await countStoredObjects()).toBe(before)
  })

  it('rejects a request missing one of the three zips', async () => {
    const response = await upload({ report: validZips.report, summary: validZips.summary })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('appendix')
  })

  it('rejects non-multipart bodies', async () => {
    const request = new Request('http://test/api/uploads', { method: 'POST', body: '{}' })

    expect((await handleUpload(request, store)).status).toBe(400)
  })

  it.each([
    ['unknown file', crypto.randomUUID(), 'report', 'index.html'],
    ['malformed upload id', 'not-a-uuid', 'report', 'index.html'],
    ['unknown role', crypto.randomUUID(), 'secrets', 'index.html'],
    ['path traversal', crypto.randomUUID(), 'report', '../summary/index.html'],
  ])('returns 404 for %s', async (_, uploadId, role, path) => {
    expect((await view(uploadId, role, path)).status).toBe(404)
  })
})

describe('bucket bootstrap', () => {
  it('expires uploads after one day', async () => {
    const lifecycle = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
    )

    expect(lifecycle.Rules).toEqual([
      expect.objectContaining({
        Status: 'Enabled',
        Filter: { Prefix: 'uploads/' },
        Expiration: { Days: 1 },
      }),
    ])
  })
})
