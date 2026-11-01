import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The dev dashboard (tools/dev-dashboard, plain JS) is served under /dev/ by this same dev server,
// so one command opens everything: the panel's "Geliştirici" tab shows it in a frame.
const devDashboard = resolve(fileURLToPath(new URL('.', import.meta.url)), '../dev-dashboard')
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }

function serveDevDashboard(): Plugin {
  return {
    name: 'serve-dev-dashboard',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x')
        if (!url.pathname.startsWith('/dev/')) return next()
        const rel = normalize(decodeURIComponent(url.pathname.slice('/dev/'.length))).replace(/^([/\\])+/, '')
        const file = join(devDashboard, rel === '' || rel === '.' ? 'index.html' : rel)
        if (!file.startsWith(devDashboard)) {
          res.statusCode = 403
          res.end()
          return
        }
        try {
          const body = await readFile(file)
          res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-store')
          res.end(body)
        } catch {
          res.statusCode = 404
          res.end('not found')
        }
      })
    },
  }
}

// The panel uses the server's own content rules (server/src/rules) to check an edit before it is
// sent, the shared palette (content/palette.hex) for the image check, and the client's bundled texts.
export default defineConfig({
  plugins: [react(), serveDevDashboard()],
  server: {
    port: 7370,
    host: '127.0.0.1',
    fs: { allow: ['.', '../../content', '../../server/src/rules', '../../client/Assets/Resources/Locales'] },
  },
})
