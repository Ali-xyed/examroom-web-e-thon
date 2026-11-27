import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import './build.mjs'

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/login', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/site.css', ['site.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/sw.js', ['sw.js', 'text/javascript']],
  ['/phase-three.js', ['phase-three.js', 'text/javascript']],
  ['/import-preview.js', ['import-preview.js', 'text/javascript']],
  ['/phase-two.js', ['phase-two.js', 'text/javascript']],
  ['/site.js', ['site.js', 'text/javascript']],
  ['/api.js', ['api.js', 'text/javascript']],
  ['/config.js', ['config.js', 'text/javascript']],
])
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const artwork = /^\/reference\/[a-z0-9-]+\.(png|svg|webp)$/.exec(pathname)
  const mime = { png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' }
  const file = files.get(pathname) ?? (artwork && [pathname.slice(1), mime[artwork[1]]])
  if (!file) return response.writeHead(404).end()
  const data = await readFile('dist/' + file[0]).catch(() => null)
  if (!data) return response.writeHead(404).end()
  response.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(data)
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log('UnCooked is running at http://127.0.0.1:' + (process.env.PORT || 4173))
})
