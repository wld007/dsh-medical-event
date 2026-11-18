/**
 * 录 README 动画的素材：虚构病人（test/fixtures）＋本机假模型端点，在 DSH 之外的预览页上真跑一批，
 * 逐帧截图到 <outDir>/frames，再由 scripts/readme-demo.py 合成动画 WebP。不碰任何真实病历。
 * 不依赖 Playwright：直接起本机 Chrome，用 DevTools 协议截图、点标签页（Node 22 自带 WebSocket）。
 *
 *   REACT_UMD_DIR=<含 react/umd 的 node_modules> node scripts/readme-demo.mjs <outDir> [病人数]
 *   python3 scripts/readme-demo.py <outDir> assets/demo.webp
 *
 * 环境变量：CHROME（Chrome 可执行文件）、DEMO_THEME（dark|light）、DEMO_DELAY_MS（假模型每次回复的延迟）、
 *          DEMO_TABS（运行结束后依次打开的标签页，| 分隔）、DEMO_VERSION（页头版本号）
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFictionalPatient } from '../test/fixtures/fictional.mjs'
import { fakeModels } from '../test/helpers.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = process.argv[2]
const nPatients = Number(process.argv[3] ?? 8)
if (!outDir || !process.env.REACT_UMD_DIR) { console.error('usage: REACT_UMD_DIR=… node scripts/readme-demo.mjs <outDir> [病人数]'); process.exit(1) }
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const work = await mkdtemp(join(tmpdir(), 'me-demo-'))
const input = join(work, 'cohort')
// 每位病人的叙述里数值略有不同（年龄、血压、病程……），句子才不会全部命中前一位病人的缓存
const vary = (v, i) => (typeof v === 'string' && /[\u4e00-\u9fa5]/.test(v) && v.length > 8 ? v.replace(/(\d+)(?=次\/分|mmHg|岁|天|年余|周余|g\/L|μmol\/L|余年|年前)/g, (d) => String(Number(d) + i)) : v)
for (let i = 1; i <= nPatients; i++) {
  const dir = await writeFictionalPatient(join(input, `HD-${String(i).padStart(4, '0')}`))
  for (const f of await readdir(dir, { recursive: true })) {
    if (!f.endsWith('.json')) continue
    const rows = JSON.parse(await readFile(join(dir, f), 'utf8'))
    await writeFile(join(dir, f), JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, vary(v, i - 1)])))))
  }
}

// 本机假模型端点（OpenAI 兼容）：规则式回答，有延迟才看得见进度；核验模型与通读模型在部分句子上意见不一
const fm = fakeModels({ stubborn: true })
const delay = Number(process.env.DEMO_DELAY_MS ?? 700)
const endpoint = http.createServer(async (req, res) => {
  let b = ''; for await (const c of req) b += c
  if (!req.url.endsWith('/chat/completions')) { res.statusCode = 404; return res.end('{}') }
  const body = JSON.parse(b)
  const m = body.model === 'reader-model' ? fm.a : fm.b
  await sleep(delay * (0.6 + Math.random() * 0.8))
  try { const r = await m.chat(body.messages); res.end(JSON.stringify({ choices: [{ message: { content: r.content } }], usage: r.usage })) } catch { res.statusCode = 500; res.end('{}') }
})
await new Promise((r) => endpoint.listen(0, '127.0.0.1', r))
const baseURL = `http://127.0.0.1:${endpoint.address().port}/v1`

const port = 18000 + Math.floor(Math.random() * 1000)
const config = { outputRoot: join(work, 'out'), baseURL, model: 'reader-model', verifyModel: 'verify-model', modelConcurrency: 3, verifyConcurrency: 3, workers: 2, shardUnits: 1, verifySampleRate: 0.4, autoConcurrency: false }
const server = spawn(process.execPath, [join(root, 'scripts/preview-page.mjs'), join(work, 'state'), String(port)], {
  env: { ...process.env, PREVIEW_CONFIG: JSON.stringify(config), PREVIEW_VERSION: process.env.DEMO_VERSION ?? '0.3.0', PREVIEW_HIDE_HOST: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((r) => server.stdout.once('data', r))
const base = `http://127.0.0.1:${port}`
const rpc = async (m, p = {}) => (await (await fetch(`${base}/rpc/${m}`, { method: 'POST', body: JSON.stringify(p) })).json()).value

/* ---- Chrome（DevTools 协议） ---- */
const profile = join(work, 'chrome')
const chrome = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' })
let devPort = null
for (let i = 0; i < 100 && !devPort; i++) { await sleep(100); try { devPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] } catch { /* 还没起来 */ } }
if (!devPort) throw new Error('Chrome 没起来')
const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let seq = 0; const waiting = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id) } })
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result))); ws.send(JSON.stringify({ id, method, params })) })
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
const go = async (url) => { await cdp('Page.navigate', { url }); await sleep(1500) }
/** 点一个文字以 label 开头的按钮（标签页、工序标签） */
const click = (label) => cdp('Runtime.evaluate', { expression: `(() => { const hit = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})).pop(); const el = hit('[role=tab]') ?? hit('button') ?? hit('.me-rank-r, g'); if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true } return false })()`, returnByValue: true }).then((r) => { if (!r.result.value) console.error('点不到', label) })

const frames = join(outDir, 'frames')
await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true })
const timeline = []
let n = 0
const snap = async (ms) => { const f = `f${String(n++).padStart(4, '0')}.png`; const { data } = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(join(frames, f), Buffer.from(data, 'base64')); timeline.push({ f, ms }) }

try {
  await cdp('Page.enable')
  await go(`${base}/?theme=${process.env.DEMO_THEME ?? 'dark'}`)
  const { runId } = await rpc('start', { inputDir: input })
  console.log('批次', runId)
  await go(`${base}/?theme=${process.env.DEMO_THEME ?? 'dark'}`)
  for (;;) {
    await snap(500)
    const { run } = await rpc('status', { runId })
    if (run.status !== 'running') { console.log('结束', run.status); break }
    await sleep(420)
  }
  await sleep(1500)
  await snap(2600)
  for (const label of (process.env.DEMO_TABS ?? '规则包|复核|时间线|报告').split('|')) { await click(label); await sleep(1500); await snap(2600) }
  await click('◈ 流水线'); await sleep(1000); await snap(1800)
} finally {
  await writeFile(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 1))
  try { ws.close() } catch { /* closed */ }
  chrome.kill(); server.kill('SIGTERM'); endpoint.close()
  await sleep(500)
  await rm(work, { recursive: true, force: true })
}
console.log(`${timeline.length} 帧 → ${frames}`)
process.exit(0)
