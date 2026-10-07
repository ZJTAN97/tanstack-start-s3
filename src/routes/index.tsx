import { Container, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { UploadForm } from '~/components/UploadForm'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <Container size="xs" py="xl">
      <Title order={2} mb="md">
        Upload sites
      </Title>
      <UploadForm />
    </Container>
  )
}
