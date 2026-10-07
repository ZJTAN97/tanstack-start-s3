import { createS3Client, ensureBucket, s3EnvSchema } from '../src/server/s3-client.server.ts'

const config = s3EnvSchema.parse(process.env)
await ensureBucket(createS3Client(config), config.bucket)
console.info(`Bucket "${config.bucket}" ready with 1-day expiry on uploads/`)
