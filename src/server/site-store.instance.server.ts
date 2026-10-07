import { createS3Client, s3EnvSchema } from './s3-client.server'
import { createSiteStore } from './site-store.server'

const config = s3EnvSchema.parse(process.env)

// One client per process: it pools sockets and caches credentials/endpoint resolution.
export const siteStore = createSiteStore(createS3Client(config), config.bucket)
