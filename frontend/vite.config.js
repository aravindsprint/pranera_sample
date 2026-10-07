import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const BACKEND = process.env.VITE_BACKEND || 'https://erp.pranera.in'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/assets/pranera_sample/sample_app/',

  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },

  server: {
    port: 3000,
    // Dev-server only — vite build never reads this (production always talks
    // to erp.pranera.in directly since it's served from that same origin).
    // Needed so `npm run dev` (localhost:3000) can reach the live backend;
    // without it every /api/* call 404s against Vite's own dev server and
    // returns HTML instead of JSON.
    proxy: command === 'serve' ? {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: true,
        cookieDomainRewrite: 'localhost',
        headers: {
          'Origin': BACKEND,
          'Referer': BACKEND
        },
        // Frappe marks its session cookie (sid) as Secure because
        // erp.pranera.in is HTTPS. Vite's dev server itself is plain HTTP
        // (localhost:3000), and browsers silently refuse to store *any*
        // Secure cookie over a non-HTTPS connection — no error, no warning,
        // it just never lands. cookieDomainRewrite only touches the
        // Domain= attribute, not Secure, so login would appear to succeed
        // (the login POST itself returns 200) while the session cookie
        // that request needed to persist for every call after it never
        // actually got stored. Strip Secure (dev only) so the cookie sticks.
        configure(proxy) {
          // node-http-proxy has a long-standing quirk: for POST/PUT requests
          // with no body (like our logout call — POST, no payload), it can
          // forward a stray `Expect` header through to the backend. nginx
          // (which fronts erp.pranera.in) responds to that with a flat
          // "417 Expectation Failed" instead of actually processing the
          // request — so frappe.auth.logout never runs server-side even
          // though the browser gets back what looks like a real HTTP
          // response. Stripping the header before it's forwarded is the
          // standard fix.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('expect')
          })
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie']
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map(c =>
                c.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
              )
            }
          })
        }
      },
      '/assets': {
        target: BACKEND,
        changeOrigin: true,
        secure: false
      },
      '/files': {
        target: BACKEND,
        changeOrigin: true,
        secure: false
      }
    } : undefined
  },

  build: {
    outDir: path.resolve(__dirname, '../pranera_sample/public/sample_app'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // Content-hashed entry. www/sample-app.py reads the real filenames
        // from the built index.html, so the page and the lazy page chunks
        // import the *same* URL. (A fixed index.js + ?v=<mtime> on the page
        // makes chunks' `import "../index.js"` a different module URL, so
        // the whole app — router, Pinia — boots twice.)
        entryFileNames: 'index-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },

  plugins: [
    vue(),
    VitePWA({
      base: '/assets/pranera_sample/sample_app/',
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Every screen in this app POSTs (save, approve, photo upload) and only
        // the server-rendered /sample-app page (www/sample-app.py) injects
        // window.csrf_token — a cached static index.html never has it. So no
        // navigate fallback: navigations always hit the server; the service
        // worker only precaches JS/CSS/icons for a fast, installable app.
        navigateFallback: null,
        runtimeCaching: [],
      },
      manifest: {
        name: 'Pranera Sample Pass',
        short_name: 'SamplePass',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/sample-app',
        scope: '/sample-app',
        icons: [
          { src: '/assets/pranera_sample/sample_app/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/pranera_sample/sample_app/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/assets/pranera_sample/sample_app/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/assets/pranera_sample/sample_app/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
}))
