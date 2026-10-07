import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core'
import mantineCss from '@mantine/core/styles.css?url'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Site upload POC' },
    ],
    links: [{ rel: 'stylesheet', href: mantineCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
        <Scripts />
      </body>
    </html>
  )
}
