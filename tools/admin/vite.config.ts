import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The panel uses the server's own content rules (server/src/rules) to check an edit before it is
// sent, and the shared palette (content/palette.hex) for the image check.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 7370,
    host: '127.0.0.1',
    fs: { allow: ['.', '../../content', '../../server/src/rules'] },
  },
})
