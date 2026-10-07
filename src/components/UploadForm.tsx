import { Alert, Anchor, Button, FileInput, List, Stack } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import {
  errorResultSchema,
  SITE_ROLES,
  uploadFormSchema,
  uploadResultSchema,
  type SiteRole,
  type UploadResult,
} from '~/shared/upload'

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: UploadResult }

async function uploadSites(files: z.infer<typeof uploadFormSchema>): Promise<Status> {
  const body = new FormData()
  for (const role of SITE_ROLES) body.append(role, files[role])

  const response = await fetch('/api/uploads', { method: 'POST', body })
  const json: unknown = await response.json()
  if (!response.ok) return { kind: 'error', message: errorResultSchema.parse(json).error }
  return { kind: 'done', result: uploadResultSchema.parse(json) }
}

export function UploadForm() {
  const [files, setFiles] = useState<Partial<Record<SiteRole, File | null>>>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = uploadFormSchema.safeParse(files)
    if (!parsed.success) {
      setStatus({ kind: 'error', message: z.prettifyError(parsed.error) })
      return
    }
    setStatus({ kind: 'uploading' })
    setStatus(await uploadSites(parsed.data).catch(() => ({ kind: 'error', message: 'Upload failed' }) as const))
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        {SITE_ROLES.map((role) => (
          <FileInput
            key={role}
            label={role}
            placeholder="Choose .zip"
            accept=".zip,application/zip"
            clearable
            value={files[role] ?? null}
            onChange={(file) => setFiles((current) => ({ ...current, [role]: file }))}
          />
        ))}

        <Button type="submit" loading={status.kind === 'uploading'}>
          Upload
        </Button>

        {status.kind === 'error' && (
          <Alert color="red" title="Upload rejected" style={{ whiteSpace: 'pre-wrap' }}>
            {status.message}
          </Alert>
        )}

        {status.kind === 'done' && (
          <Alert color="green" title="Uploaded — links expire within a day">
            <List>
              {SITE_ROLES.map((role) => (
                <List.Item key={role}>
                  <Anchor href={status.result.sites[role]} target="_blank">
                    {role}
                  </Anchor>
                </List.Item>
              ))}
            </List>
          </Alert>
        )}
      </Stack>
    </form>
  )
}
