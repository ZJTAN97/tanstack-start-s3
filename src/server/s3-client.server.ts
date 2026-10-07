import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { z } from 'zod'

export const UPLOADS_PREFIX = 'uploads/'

export const s3EnvSchema = z
  .object({
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
  })
  .transform((env) => ({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
  }))

export type S3Config = z.output<typeof s3EnvSchema>

export function createS3Client(config: S3Config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    // MinIO serves buckets as http://host/bucket, not http://bucket.host
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

// Infra bootstrap (needs admin rights) — run from scripts/tests, never from request handlers.
export async function ensureBucket(client: S3Client, bucket: string) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  } catch (error) {
    if (!(error instanceof BucketAlreadyOwnedByYou)) throw error
  }
  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'expire-uploads-daily',
            Status: 'Enabled',
            Filter: { Prefix: UPLOADS_PREFIX },
            Expiration: { Days: 1 },
          },
        ],
      },
    }),
  )
}
