import { createFileRoute } from '@tanstack/react-router'
import { handleUpload } from '~/server/handle-upload.server'
import { siteStore } from '~/server/site-store.instance.server'

export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: ({ request }) => handleUpload(request, siteStore),
    },
  },
})
