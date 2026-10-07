import { GetObjectCommand, NoSuchKey, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { SiteRole } from '~/shared/upload'
import { UPLOADS_PREFIX } from './s3-client.server'
import type { SiteFile } from './site-archive'

export type SiteRef = { uploadId: string; role: SiteRole }

export type StoredFile = {
  body: ReadableStream<Uint8Array>
  contentType: string
  contentLength?: number
}

const keyFor = ({ uploadId, role }: SiteRef, path: string) =>
  `${UPLOADS_PREFIX}${uploadId}/${role}/${path}`

export function createSiteStore(client: S3Client, bucket: string) {
  return {
    async saveSite(site: SiteRef, files: SiteFile[]) {
      await Promise.all(
        files.map((file) =>
          client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: keyFor(site, file.path),
              Body: file.bytes,
              ContentType: file.contentType,
            }),
          ),
        ),
      )
    },

    async readFile(site: SiteRef, path: string): Promise<StoredFile | null> {
      try {
        const object = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: keyFor(site, path) }),
        )
        return {
          // Stream straight through; never buffer whole objects in the server.
          body: object.Body!.transformToWebStream(),
          contentType: object.ContentType ?? 'application/octet-stream',
          contentLength: object.ContentLength,
        }
      } catch (error) {
        if (error instanceof NoSuchKey) return null
        throw error
      }
    },
  }
}

export type SiteStore = ReturnType<typeof createSiteStore>
