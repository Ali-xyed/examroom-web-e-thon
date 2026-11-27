import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import './build.mjs'

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/api.js', ['api.js', 'text/javascript']],
  ['/config.js', ['config.js', 'text/javascript']],
])
createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname)
  if (!file) return response.writeHead(404).end()
  response.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(await readFile('dist/' + file[0]))
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log('Examroom is running at http://127.0.0.1:' + (process.env.PORT || 4173))
})
