import { mkdirSync, writeFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

const OUT_DIR = 'samples'

// 1x1 PNG, stretched by CSS — enough to prove binary images survive the round trip.
const PIXEL_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
)

const banner = (color: string, label: string) =>
  strToU8(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" rx="12" fill="${color}"/><text x="24" y="72" font-family="sans-serif" font-size="40" fill="white">${label}</text></svg>`,
  )

const page = (title: string) =>
  strToU8(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="css/styles.css" />
    <link rel="stylesheet" href="css/theme/colors.css" />
  </head>
  <body>
    <img class="banner" src="images/banner.svg" alt="${title} banner" />
    <h1>${title}</h1>
    <p>If this text is styled and both images show, CSS and images were stored and served correctly.</p>
    <p>Nested image: <img class="pixel" src="images/icons/pixel.png" alt="pixel" /></p>
    <p id="script-check">Scripts are blocked (sandbox).</p>
    <script>document.getElementById('script-check').textContent = 'SCRIPT RAN — sandbox is NOT working'</script>
  </body>
</html>
`)

function site(title: string, color: string) {
  return {
    'index.html': page(title),
    'css/styles.css': strToU8('body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; }\n.pixel { width: 24px; height: 24px; vertical-align: middle; }\n'),
    'css/theme/colors.css': strToU8(`h1 { color: ${color}; }\n`),
    'images/banner.svg': banner(color, title),
    'images/icons/pixel.png': PIXEL_PNG,
  }
}

const samples = {
  // Files at the zip root.
  'report.zip': site('Report', '#d9480f'),
  // Wrapped in a top-level folder, as when you zip the folder itself.
  'summary.zip': Object.fromEntries(
    Object.entries(site('Summary', '#2b8a3e')).map(([path, bytes]) => [`summary-export/${path}`, bytes]),
  ),
  // Includes macOS junk entries that should be ignored.
  'appendix.zip': {
    ...site('Appendix', '#1864ab'),
    '__MACOSX/._index.html': strToU8('junk'),
    'images/.DS_Store': strToU8('junk'),
  },
  // Should be rejected with "index.html missing at zip root".
  'invalid-no-index.zip': { 'home.html': page('No index') },
}

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, files] of Object.entries(samples)) {
  writeFileSync(`${OUT_DIR}/${name}`, zipSync(files))
  console.info(`${OUT_DIR}/${name}`)
}
