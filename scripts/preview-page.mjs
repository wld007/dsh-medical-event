/**
 * Local preview of the page outside the Harness: serves client.js with React
 * and answers its RPC calls from the real service.
 *
 *   REACT_UMD_DIR=<node_modules with react/umd> node scripts/preview-page.mjs <stateDir> [port]
 *   open http://127.0.0.1:<port>/?tab=timeline
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createService } from '../lib/service.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const stateDir = process.argv[2]
const port = Number(process.argv[3] ?? 18767)
const umd = process.env.REACT_UMD_DIR
if (!stateDir || !umd) { console.error('usage: REACT_UMD_DIR=<node_modules> node scripts/preview-page.mjs <stateDir> [port]'); process.exit(1) }
const service = createService({ stateDir })

const page = `<!doctype html><meta charset="utf-8"><title>preview</title>
<style>html,body,#root{margin:0;height:100%}body{background:#081116}</style>
<div id="root"></div>
<script src="/react.js"></script><script src="/react-dom.js"></script>
<script>let def = null; window.__ModuleLoader__ = { load(d) { def = d } }</script>
<script src="/client.js"></script>
<script>
  const plugin = def.factory((name) => (name === 'react' ? React : {}))
  let Page = null
  const ctx = {
    get(name) {
      if (name === 'connection') return { rpc: { call: (_c, endpoint, payload) => fetch('/rpc/' + endpoint, { method: 'POST', body: JSON.stringify(payload ?? {}) }).then((r) => r.json()) } }
      return null
    },
    slots: { inject: (_n, fn) => { fn(); return () => {} }, register: (opts, c) => { if (opts.name === 'main') Page = c; return () => {} } },
  }
  plugin.apply(ctx)
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Page))
  const q = new URLSearchParams(location.search)
  const clickText = (sel, text) => { for (const el of document.querySelectorAll(sel)) if (el.textContent.includes(text)) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true } return false }
  const steps = (q.get('steps') || '').split('|').filter(Boolean)
  let i = 0
  const timer = setInterval(() => {
    if (i >= steps.length) return clearInterval(timer)
    const [sel, text] = steps[i].split('~')
    if (clickText(sel, text)) i++
  }, 400)
</script>`

const handlers = {
  config: () => service.configInfo(),
  list: () => service.list(),
  status: (p) => service.status(p.runId),
  report: (p) => service.report(p.runId),
  calls: (p) => service.calls(p.runId),
  timeline: (p) => service.timeline(p.runId, p.patient),
  event: (p) => service.eventDetail(p.runId, p.patient, p.eventId),
  finding: (p) => service.findingDetail(p.runId, p.patient, p.findingId),
  reviewQueue: (p) => service.reviewQueue(p.runId),
  documents: (p) => service.documents(p.runId, p.patient),
  fragment: (p) => service.fragment(p.runId, p.patient, p.fragmentId),
  rulepack: (p) => service.rulepack(p.specialty),
}

http.createServer(async (req, res) => {
  try {
    if (req.url === '/' || req.url.startsWith('/?')) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(page) }
    if (req.url === '/react.js') return res.end(await readFile(join(umd, 'react/umd/react.production.min.js')))
    if (req.url === '/react-dom.js') return res.end(await readFile(join(umd, 'react-dom/umd/react-dom.production.min.js')))
    if (req.url === '/client.js') { res.setHeader('content-type', 'text/javascript'); return res.end(await readFile(join(root, 'client.js'))) }
    if (req.url.startsWith('/rpc/')) {
      const endpoint = req.url.slice(5)
      let body = ''
      for await (const chunk of req) body += chunk
      const handler = handlers[endpoint]
      if (!handler) return res.end(JSON.stringify({ ok: false, error: { message: `preview: ${endpoint} not available` } }))
      try { return res.end(JSON.stringify({ ok: true, value: await handler(JSON.parse(body || '{}')) })) } catch (error) { return res.end(JSON.stringify({ ok: false, error: { message: String(error?.message ?? error) } })) }
    }
    res.statusCode = 404; res.end()
  } catch (error) { res.statusCode = 500; res.end(String(error)) }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`))
