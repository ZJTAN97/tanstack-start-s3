import { createFileRoute } from '@tanstack/react-router'
import { handleView } from '~/server/handle-view.server'
import { siteStore } from '~/server/site-store.instance.server'

export const Route = createFileRoute('/view/$uploadId/$role/$')({
  server: {
    handlers: {
      GET: ({ params }) => handleView(params, siteStore),
    },
  },
})
