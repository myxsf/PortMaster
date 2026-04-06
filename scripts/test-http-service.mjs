import http from 'node:http'

const port = Number(process.argv[2] || 43111)

if (!Number.isFinite(port) || port <= 0) {
  console.error('Invalid port.')
  process.exit(1)
}

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  response.end(
    JSON.stringify({
      ok: true,
      port,
      path: request.url,
      pid: process.pid,
    }),
  )
})

server.listen(port, '127.0.0.1', () => {
  console.log(`test-http-service listening on http://127.0.0.1:${port}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
