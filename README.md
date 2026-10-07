# TanStack Start + S3 (MinIO) POC

Upload 3 zipped static sites (`report`, `summary`, `appendix`) → unzip in memory → store under one MinIO prefix per site → serve through a sandboxed proxy route. Objects expire after 1 day.

```bash
pnpm install
pnpm minio:up      # MinIO on :9000 (console :9001) + bucket/lifecycle bootstrap
pnpm dev           # http://localhost:3000
pnpm test          # unit + integration (integration needs Docker; starts its own MinIO)
pnpm samples       # regenerate samples/*.zip
```

Sample zips to upload from the UI are in [`samples/`](samples): `report.zip` (files at root), `summary.zip` (wrapped in a folder), `appendix.zip` (includes `__MACOSX` junk), and `invalid-no-index.zip` (should be rejected).

## Flow

```
POST /api/uploads (multipart: report, summary, appendix)
  → zod validates 3 .zip Files (shared schema, also used by the UI)
  → extractSite() each zip in memory (fflate) — all 3 must pass before anything is written
  → PutObject  uploads/{uploadId}/{role}/{relative path}   (ContentType from allowlist)
  ← 201 { uploadId, sites: { role: /view/{uploadId}/{role}/index.html } }

GET /view/{uploadId}/{role}/{...path}
  → zod validates params (uuid, role enum, no traversal)
  → GetObject → Body.transformToWebStream() → Response   (streamed, never buffered)
     headers: Content-Security-Policy: sandbox, X-Content-Type-Options: nosniff
```

## Decisions

| Concern | Choice | Why |
| --- | --- | --- |
| S3 client | One `S3Client` per process (`site-store.instance.server.ts`), `forcePathStyle: true` | Client pools sockets; MinIO uses path-style URLs |
| Testability | `createSiteStore(client, bucket)` + handlers take the store as an argument | Integration tests inject a Testcontainers MinIO — no SDK mocking |
| Server-only code | `*.server.ts` naming | TanStack Start import protection blocks these from the client bundle |
| Unzip | In memory with `fflate`, no temp files | Zips ≤ 50 MB; limits on entry count + declared uncompressed size are checked from the central directory **before** inflating |
| Uploads | `PutObjectCommand` per file | Files are small; use `@aws-sdk/lib-storage` `Upload` only for large single objects (multipart) |
| Serving | Proxy route, not presigned URLs | A presigned URL signs one object; relative CSS/image links from the HTML would be unsigned → 403 |
| Untrusted HTML | `CSP: sandbox` | Page runs in an opaque origin with no scripts, so it can't read app cookies or call app APIs |
| Bucket + 1-day expiry | `scripts/setup-bucket.ts` via `PutBucketLifecycleConfiguration` (idempotent) | Infra concern; the app's runtime credentials only need Get/Put |

## Known limits / next steps for prod

- `request.formData()` buffers the whole body (≤ ~150 MB). The `content-length` check only rejects honest clients — also cap body size at the reverse proxy. Switch to a streaming multipart parser (e.g. busboy) if limits grow.
- `unzipSync` blocks the event loop briefly per zip; move to a worker if upload concurrency is high.
- Unsupported extensions (e.g. `.js`) reject the upload — extend `CONTENT_TYPES` in `site-archive.ts` as needed. Scripts wouldn't run under the sandbox anyway.
- Web fonts loaded from a sandboxed (opaque-origin) page need `Access-Control-Allow-Origin` on the font response.
- In production, use a separate domain for `/view` (like `githubusercontent.com`) for defence in depth.
- MinIO lifecycle expiry is applied by a background scanner, so objects may live slightly over 24 h.
- `minio/minio` images are no longer pullable from Docker Hub; this POC uses `cgr.dev/chainguard/minio`.
