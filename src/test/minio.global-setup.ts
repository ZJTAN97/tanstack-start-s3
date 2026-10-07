import { GenericContainer, Wait } from 'testcontainers'
import type { TestProject } from 'vitest/node'
import { createS3Client, ensureBucket, type S3Config } from '~/server/s3-client.server'

declare module 'vitest' {
  export interface ProvidedContext {
    s3Config: S3Config
  }
}

export default async function setup(project: TestProject) {
  const container = await new GenericContainer('cgr.dev/chainguard/minio:latest')
    .withCommand(['server', '/data'])
    .withEnvironment({ MINIO_ROOT_USER: 'test-user', MINIO_ROOT_PASSWORD: 'test-password' })
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
    .start()

  const config: S3Config = {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
    region: 'us-east-1',
    accessKeyId: 'test-user',
    secretAccessKey: 'test-password',
    bucket: 'sites-test',
  }
  await ensureBucket(createS3Client(config), config.bucket)
  project.provide('s3Config', config)

  return () => container.stop()
}
