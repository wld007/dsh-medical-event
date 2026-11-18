/**
 * Host half of the 病历事件还原 bundle.
 *
 * Registers agent tools, the /event command and one authenticated browser RPC
 * channel. Every caller shares the same service.
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createService, SAVABLE } from './lib/service.js'

export const name = 'medical-event'
export const inject = ['tools']

const CHANNEL = '/medical-event'
const VERSION = (() => { try { return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version } catch { return null } })()
const ENTRY_ID = 'medical-event'

const DATA_BOUNDARY = '病历内容只发往用户在插件设置中配置的模型端点（通常为本机或内网）；没有配置通读模型时不能运行。'

export function apply(ctx, config = {}) {
  const workingDirectory = ctx.get('workingDirectory')
  const defaultDirectory = workingDirectory?.defaultDirectory ?? process.cwd()
  const stateDir = process.env.DSH_PROFILE_DIR
    ? join(process.env.DSH_PROFILE_DIR, 'plugin-data', 'medical-event')
    : join(homedir(), '.dsh', 'plugin-data', 'medical-event')
  const service = createService({ config, defaultDirectory, stateDir })
  if (typeof ctx.effect === 'function') ctx.effect(() => () => service.dispose(), 'medical-event: cancel running batch')

  ctx.tools.register(tool({
    name: 'event_start',
    description: `dsh-medical-event 插件（病历事件还原）：把病历（区域平台导出 p_doc_*.json，或其他 json／ndjson／csv／tsv／xlsx 导出，自动识别格式；通常是 dsh-medical-anonymizer 的交付目录）还原成可计算的事件：通读模型逐句读出提及（类型、写成时间与发生时间），核验模型抽样背靠背再读，不一致的两个模型轮流复查，仍不一致转人工；规则对照、把同一件事归并成事件、登记记录之间的冲突，质检不通过不往下游交。按病人分组、数据块并行，可取消、可从取消或失败处继续。每位病人交付一个事件包（manifest、提及、事件、发现、复核项，及用药暴露区间、检验长表等导出），放在输出根目录的 output/<输入名>（下游只读 output）；报告与人工判断放在 _records。绝不修改源文件。${DATA_BOUNDARY}立即返回批次 id。`,
    parameters: {
      inputDir: { type: 'string', description: '病人导出目录（一位病人，或包含多位病人的上级目录）的绝对路径或相对工作区的路径。' },
      outputRoot: { type: 'string', description: '输出根目录，不能与输入相同或包含输入；交付数据放在它下面的 output/<输入名>，报告与记录放在 _records。省略时用设置里的默认值，再缺省为输入旁的 _medical-event。' },
      mode: { type: 'string', description: 'hybrid（默认：模型通读＋规则对照，模型漏的规则补上，复查仍不一致时规则作第三票）或 model（只用模型，复查仍不一致直接转人工）。' },
      maxRounds: { type: 'number', description: '复查轮次上限（1–6）：核验分歧两个模型轮流复查，至多这么多轮；省略时用设置里的默认值。' },
      asOf: { type: 'string', description: '截至时刻 "YYYY-MM-DD HH:mm"：只用此刻以前写成的记录还原（评测截断用）；省略则不截断。' },
      resumeFrom: { type: 'string', description: '继续一个已取消或失败的批次（填批次 id）；已完成的数据块和模型调用直接复用。填写时可省略其他参数。' },
    },
    execute: async (args, exec) => service.start({ ...args, source: { kind: 'agent', sessionId: sessionIdOf(exec?.agent) } }),
    render: (args, v) => [{ type: 'text', text: `已启动批次 ${v.runId}（${v.mode}，通读 ${v.model}${v.verifyModel ? `，核验 ${v.verifyModel}` : '，未配核验模型'}），输出到 ${v.outputRoot}。用 event_status 查看进度。` }],
  }))

  ctx.tools.register(tool({
    name: 'event_cancel',
    description: '取消正在运行的病历事件还原批次。已完成的数据块保留在 _records/runs/<批次>（不进 output），可用 event_start 的 resumeFrom 继续。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取消当前批次。' } },
    execute: async (args) => service.cancel(args.runId),
    render: (args, v) => [{ type: 'text', text: v.cancelled ? `已请求取消批次 ${v.runId}。` : `没有取消：${v.reason}` }],
  }))

  ctx.tools.register(tool({
    name: 'event_status',
    description: '查看病历事件还原批次的状态、进度（数据块、病人）、通读与核验统计、质检与待复核数。省略 runId 时查看最近一批。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.status(args.runId),
    render: (args, value) => {
      const run = value.run
      if (!run) return [{ type: 'text', text: '还没有病历事件还原批次。' }]
      const t = run.totals ?? {}
      const lines = [
        `批次 ${run.id}: ${run.status}${run.current ? `（${run.current.patient ? `${run.current.patient} · ` : ''}${run.current.step}）` : ''}${run.mode ? `；${run.mode}` : ''}`,
        `数据块 ${run.shards?.done ?? 0}/${run.shards?.total ?? 0}；病人 ${t.done ?? 0}/${t.patients ?? 0}（出错 ${t.failed ?? 0}，质检未过 ${t.failedGates ?? 0}）；提及 ${t.mentions ?? 0}，事件 ${t.events ?? 0}，发现 ${t.findings ?? 0}；待复核 ${t.review ?? 0}`,
      ]
      if (t.units) lines.push(`通读：句子 ${t.units}（去重后 ${t.unique}）；核验抽查 ${t.sampled}；分歧 ${t.disputes}，复查后一致 ${t.resolved}，规则第三票 ${t.byRule}，转人工 ${t.human}；模型调用 ${t.calls ?? 0}（失败 ${t.failedCalls ?? 0}）`)
      for (const g of run.gates ?? []) lines.push(`质检${g.id} ${g.label}：${g.skipped ? '跳过' : g.pass ? '通过' : '未过'}（${g.detail}）`)
      for (const w of run.warnings ?? []) lines.push(`提示：${w}`)
      if (run.output) lines.push(`交付：${run.output}`)
      if (run.error) lines.push(`错误：${run.error.split('\n')[0]}`)
      return [{ type: 'text', text: lines.join('\n') }]
    },
  }))

  ctx.tools.register(tool({
    name: 'event_report',
    description: '读取病历事件还原批次的 Markdown 报告（汇总、质检、通读与核验、各病人、发现分类、模型调用）。报告不含病历原文。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.report(args.runId),
    render: (args, v) => [{ type: 'text', text: v.markdown.length > 8000 ? `${v.markdown.slice(0, 8000)}\n…（完整内容见 ${v.path}）` : v.markdown }],
  }))

  ctx.tools.register(tool({
    name: 'event_runs',
    description: '列出最近的病历事件还原批次（时间、状态、病人数、提及、发现、待复核数）。',
    parameters: {},
    execute: async () => service.list(),
    render: (args, v) => [{ type: 'text', text: v.runs.length ? v.runs.slice(0, 20).map((r) => `${r.id}  ${r.status}  病人 ${r.patients}  提及 ${r.mentions}  发现 ${r.findings}  待复核 ${r.review}  ${r.input}`).join('\n') : '还没有批次。' }],
  }))

  ctx.tools.register(tool({
    name: 'event_formats',
    description: '查看病历事件还原批次的格式识别结果（非区域平台导出：每张表识别出的记录类别、写成时间、病人、就诊与栏目，状态为自动采用／已确认／有分歧／校验未过／待确认／已跳过），或判断一张表：confirm 采用当前读法（可附改过的 spec，或 use 采用某份方案 model／verify／rule）、reject 跳过、reset 下次重新识别。判断存在本机格式库，重跑时生效。',
    parameters: {
      runId: { type: 'string', description: '批次 id；省略则取最近一批。' },
      signature: { type: 'string', description: '判断时：表的签名（列表里给出）。' },
      action: { type: 'string', description: '判断时：confirm、reject 或 reset。' },
      use: { type: 'string', description: 'confirm 时：采用哪份方案（model、verify、rule）。' },
      spec: { type: 'object', description: 'confirm 时：改过的读法（JSON，格式同列表里的 spec）。' },
    },
    execute: async (args) => (args.signature ? service.formatDecide(args) : service.formats(args.runId ?? (await service.status()).run?.id)),
    render: (args, v) => {
      if (v.ok !== undefined) return [{ type: 'text', text: '已保存判断；重跑后生效。' }]
      const lines = (v.tables ?? []).map((t) => `${t.signature}  ${t.status}  ${t.recordType ?? '—'}  ${t.table}${t.borrowedFrom ? `（沿用${t.borrowedFrom}）` : ''}${t.diffs?.length ? `  分歧：${t.diffs.join('；')}` : ''}${t.problems?.length ? `  问题：${t.problems.slice(0, 2).join('；')}` : ''}`)
      return [{ type: 'text', text: lines.length ? lines.join('\n') : '这个批次没有格式识别（区域平台导出）。' }]
    },
  }))

  ctx.inject(['commands'], (cmdCtx) => {
    const usage = '用法：/event <病人导出目录> [--mode hybrid|model] [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]（路径含空格时用引号括起来）'
    const dispose = cmdCtx.commands.register({
      name: 'event',
      description: '病历事件还原：/event <病人导出目录> [--mode hybrid|model] [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]',
      input: { hint: '病人导出目录 [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]' },
      handler: async (invocation) => {
        const args = String(invocation.rawInput ?? '').match(/"[^"]*"|'[^']*'|\S+/g)?.map((x) => x.replace(/^["']|["']$/g, '')) ?? []
        const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined }
        const outputRoot = flag('--out'); const asOf = flag('--as-of'); const mode = flag('--mode')
        if (!args[0]) return { kind: 'error', text: usage }
        try {
          const v = await service.start({ inputDir: args[0], outputRoot, asOf, mode, source: { kind: 'command', sessionId: sessionIdOf(invocation.agent) } })
          return { kind: 'success', text: `已启动批次 ${v.runId}（${v.mode}，通读 ${v.model}），输出到 ${v.outputRoot}。用 event_status 或左侧栏「病历事件还原」查看进度。` }
        } catch (error) {
          return { kind: 'error', text: String(error?.message ?? error) }
        }
      },
    })
    cmdCtx.effect(() => dispose, 'medical-event: /event command')
  })

  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
    const route = {
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        const admission = rpcCtx.connection.admit(req)
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden'); return }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const endpoint = new URL(req.url ?? '/', 'http://x').pathname.slice(CHANNEL.length + 1)
        if (!endpoint) { res.writeHead(404); res.end(); return }
        if (req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { res.writeHead(415); res.end(); return }
        let body
        try {
          const chunks = []; let size = 0
          for await (const chunk of req) { size += chunk.length; if (size > 4_000_000) throw new Error('request body too large'); chunks.push(chunk) }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(error?.message ?? error) })); return
        }
        const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request'
        if (body?.type !== 'client-request' || body?.method !== endpoint) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'bad-request', message: 'invalid client-request envelope', details: {} } } }))
          return
        }
        const result = await dispatch(endpoint, body.payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
      },
    }
    rpcCtx.effect(() => rpcCtx.webServer.register(route), 'medical-event: rpc route')
  })

  /** User-only (page): persists settings into the profile's patch layer. */
  async function saveDefaults(patch) {
    if (service.isRunning()) throw new Error('有批次在运行，保存设置会重新加载插件并中断批次；请等它结束')
    const editor = ctx.get('configEditor')
    if (!editor?.edit || !editor?.entries) throw new Error('当前 DSH 不支持从页面保存配置；请在 profile 的 cordis.patch.yml 中修改 medical-event 的 config')
    const entries = editor.entries()
    let entry
    try { entry = entries.find((item) => item.fiber === ctx.fiber) } catch { /* fall back */ }
    entry ??= entries.find((item) => item.options?.id === ENTRY_ID)
    if (!entry) throw new Error(`找不到插件配置行 ${ENTRY_ID}`)
    const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => SAVABLE.includes(k)))
    await editor.edit(entry, (current) => ({ ...current, ...clean }))
    return { saved: true }
  }

  async function dispatch(endpoint, payload) {
    try {
      const r = payload && typeof payload === 'object' ? payload : {}
      const value = await (async () => {
        switch (endpoint) {
          case 'config': return { ...service.configInfo(), version: VERSION }
          case 'list': return service.list()
          case 'status': return service.status(r.runId)
          case 'report': return service.report(r.runId)
          case 'start': return service.start({ inputDir: r.inputDir, outputRoot: r.outputRoot || undefined, mode: r.mode || undefined, maxRounds: r.maxRounds || undefined, asOf: r.asOf || undefined, resumeFrom: r.resumeFrom, source: { kind: 'panel' } })
          case 'cancel': return service.cancel(r.runId)
          case 'files': return service.files(r.runId, r)
          case 'patients': return service.patients(r.runId, r)
          case 'patient': return service.patientData(r.runId, r.patient, Array.isArray(r.parts) ? r.parts : undefined)
          case 'documents': return service.documents(r.runId, r.patient)
          case 'fragment': return service.fragment(r.runId, r.patient, r.fragmentId)
          case 'timeline': return service.timeline(r.runId, r.patient)
          case 'event': return service.eventDetail(r.runId, r.patient, r.eventId)
          case 'finding': return service.findingDetail(r.runId, r.patient, r.findingId)
          case 'reviewQueue': return service.reviewQueue(r.runId, r)
          case 'decide': return service.decide(r.runId, r)
          case 'addMention': return service.addMention(r.runId, r)
          case 'applyDecisions': return service.applyDecisions(r.runId)
          case 'rulepack': return service.rulepack(r.specialty)
          case 'calls': return service.calls(r.runId)
          case 'formats': return service.formats(r.runId)
          case 'formatDecide': return service.formatDecide({ signature: r.signature, action: r.action, use: r.use, spec: r.spec })
          case 'pickFolder': return { path: await pickFolder() }
          case 'saveDefaults': return saveDefaults(r)
          // 设置页的模型下拉、清空批次记录（只在页面上用，不是 Agent 工具）
          case 'models': return service.models({ baseURL: r.baseURL, apiKey: r.apiKey })
          case 'clearRuns': return service.clearRuns({ deliverable: r.deliverable === true })
          default: throw Object.assign(new Error(`未知方法: ${endpoint}`), { code: 'unknown-endpoint' })
        }
      })()
      return { ok: true, value: plain(value) }
    } catch (error) {
      return { ok: false, error: { code: error?.code ?? 'medical-event', message: String(error?.message ?? error), details: {} } }
    }
  }
}

/**
 * 系统的“选择文件夹”对话框（macOS，osascript）。取消时返回 null。
 * 其他平台抛错，由页面退回宿主的目录选择器或手填路径。
 */
function pickFolder() {
  if (process.platform !== 'darwin') return Promise.reject(Object.assign(new Error('系统文件夹对话框目前只支持 macOS；请直接在输入框里填写完整路径'), { code: 'unsupported' }))
  const script = 'POSIX path of (choose folder with prompt "选择病人导出目录（一位病人，或包含多位病人的上级目录）")'
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        // -128：用户点了取消
        if (/-128/.test(String(stderr)) || /-128/.test(String(error.message))) resolve(null)
        else reject(new Error(String(stderr || error.message).trim()))
        return
      }
      resolve(String(stdout).trim().replace(/(.)\/$/, '$1') || null)
    })
  })
}

function sessionIdOf(agent) {
  try { const id = agent?.session?.id; return typeof id === 'string' ? id : undefined } catch { return undefined }
}

function tool(def) {
  const properties = {}; const required = []
  for (const [key, spec] of Object.entries(def.parameters ?? {})) {
    properties[key] = { type: spec.type, ...(spec.description ? { description: spec.description } : {}), ...(spec.type === 'array' ? { items: { type: 'string' } } : {}), ...(spec.type === 'object' ? { additionalProperties: true } : {}) }
    if (spec.required) required.push(key)
  }
  return {
    name: def.name,
    description: def.description,
    parameters: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: def.render ?? ((args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]) },
    // 宿主要求输出是无损 JSON：去掉 undefined、SQLite 行的空原型等
    execute: async (...args) => plain(await def.execute(...args)),
  }
}

const plain = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)))
